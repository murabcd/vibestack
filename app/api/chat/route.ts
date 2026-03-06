import { createAnthropic } from "@ai-sdk/anthropic";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { createOpenAI } from "@ai-sdk/openai";
import { Sandbox } from "@vercel/sandbox";
import {
	consumeStream,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	pruneMessages,
	stepCountIs,
	ToolLoopAgent,
	validateUIMessages,
} from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { unstable_cache as cache } from "next/cache";
import { after, type NextRequest, NextResponse } from "next/server";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { ChatUIMessage } from "@/components/chat/types";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import { getAvailableModels, getModelOptions } from "@/lib/ai/gateway";
import { dataPartSchema } from "@/lib/ai/messages/data-parts";
import { metadataSchema } from "@/lib/ai/messages/metadata";
import { isProtectedMutationPath } from "@/lib/ai/safety/protected-paths";
import { tools } from "@/lib/ai/tools";
import { getSandboxCredentials } from "@/lib/ai/tools/sandbox-env";
import type { AppUsage } from "@/lib/ai/usage";
import { checkBotIdForRequest } from "@/lib/botid/server";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/index";
import {
	createProjectRun,
	getProjectById,
	replaceProjectMessages,
	updateProject,
	updateProjectLastContext,
	updateProjectRun,
} from "@/lib/db/queries";
import { connectors } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import {
	validateLocalMcpCommand,
	validateRemoteMcpUrl,
} from "@/lib/security/mcp";
import { getSessionFromReq } from "@/lib/session/server";
import prompt from "./prompt.md";
import {
	compactMessagesForModel,
	compactMessagesForPersistence,
	injectRelevantFileContentMessage,
	prepareMessagesForAgent,
	type RelevantFileContent,
	readResponsePreview,
	reconcileIncompleteTaskMessages,
	sanitizeMessagesForModel,
	truncateString,
} from "./stream-utils";

const getTokenlensCatalog = cache(
	async (): Promise<ModelCatalog | undefined> => {
		try {
			return await fetchModels();
		} catch (error) {
			logger.error({
				event: "tokenlens.catalog.fetch_failed",
				error: error instanceof Error ? error.message : String(error),
			});
			return; // tokenlens helpers will fall back to defaultCatalog
		}
	},
	["tokenlens-catalog"],
	{ revalidate: 24 * 60 * 60 }, // 24 hours
);

interface BodyData {
	messages: ChatUIMessage[];
	modelId?: string;
	reasoningEffort?: "low" | "medium" | "high";
	permissionMode?: "ask-permissions" | "auto-accept-edits";
	webSearch?: boolean;
	projectId?: string;
	sandboxDuration?: number;
	mcpServerIds?: string[];
	background?: boolean;
}

const MAX_REPORT_ERRORS_SUMMARY_CHARS = 800;
const MAX_REPORT_ERRORS_PATHS = 20;
const BACKGROUND_RUN_TIMEOUT_MS = 4 * 60 * 1000;
const BACKGROUND_RUN_PREVIEW_CHARS = 1200;
const MAX_CONSECUTIVE_TOOL_ERRORS = 4;
const TOOL_COOLDOWN_FAILURE_THRESHOLD = 2;
const MAX_LRU_FILE_CONTEXT_FILES = 6;
const MAX_LRU_FILE_CONTEXT_CHARS_PER_FILE = 3000;
const MAX_LRU_FILE_CONTEXT_TOTAL_CHARS = 12000;
const openaiProvider = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const anthropicProvider = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
	const wide = createApiWideEvent(req, "chat.stream");
	let logged = false;
	const endWide = (
		statusCode: number,
		outcome: "success" | "error",
		error?: unknown,
		extra?: Record<string, unknown>,
	) => {
		if (logged) return;
		logged = true;
		wide.end(statusCode, outcome, error, extra);
	};

	// Parallelize bot check, model fetching, and request parsing for faster startup
	const [checkResult, models, body] = await Promise.all([
		checkBotIdForRequest(),
		getAvailableModels(),
		req.json() as Promise<BodyData>,
	]);

	if (checkResult.isBot) {
		endWide(403, "error", new Error("Bot detected"));
		return NextResponse.json({ error: `Bot detected` }, { status: 403 });
	}

	const {
		messages,
		modelId = DEFAULT_MODEL,
		reasoningEffort = "medium",
		permissionMode = "ask-permissions",
		webSearch = false,
		projectId,
		sandboxDuration,
		mcpServerIds,
		background = false,
	} = body;
	const shouldRunInBackground =
		background && process.env.NODE_ENV !== "development";

	let validatedMessages: ChatUIMessage[];
	try {
		validatedMessages = await validateUIMessages<ChatUIMessage>({
			messages,
			metadataSchema: metadataSchema.optional(),
			dataSchemas: dataPartSchema.shape,
		});
	} catch (error) {
		endWide(400, "error", error, { invalid_messages: true });
		return NextResponse.json(
			{ error: "Invalid chat message format." },
			{ status: 400 },
		);
	}

	const reconciledIncoming = reconcileIncompleteTaskMessages(validatedMessages);
	validatedMessages = reconciledIncoming.messages;
	if (reconciledIncoming.stats.reconciledCodingTasks > 0) {
		wide.add({
			reconciled_incoming_coding_tasks:
				reconciledIncoming.stats.reconciledCodingTasks,
		});
	}

	wide.add({
		model_id: modelId,
		permission_mode: permissionMode,
		web_search: webSearch,
		project_id: projectId,
		message_count: validatedMessages.length,
		mcp_server_ids_count: mcpServerIds?.length ?? 0,
		permission: "stream_chat",
	});

	// Fetch MCP servers if IDs are provided
	let mcpServers: Array<{
		name: string;
		type: "local" | "remote";
		baseUrl?: string | null;
		command?: string | null;
		env?: Record<string, string> | null;
		oauthClientId?: string | null;
		oauthClientSecret?: string | null;
	}> = [];

	if (mcpServerIds && mcpServerIds.length > 0) {
		try {
			const session = await getSessionFromReq(req);

			if (session?.user?.id) {
				wide.add({ user_id: session.user.id });
				const userConnectors = await db
					.select()
					.from(connectors)
					.where(
						and(
							eq(connectors.userId, session.user.id),
							eq(connectors.status, "connected"),
							inArray(connectors.id, mcpServerIds),
						),
					);

				mcpServers = userConnectors.map((connector) => ({
					name: connector.name,
					type: connector.type as "local" | "remote",
					baseUrl: connector.baseUrl,
					command: connector.command,
					env: connector.env ? JSON.parse(decrypt(connector.env)) : null,
					oauthClientId: connector.oauthClientId,
					oauthClientSecret: connector.oauthClientSecret
						? decrypt(connector.oauthClientSecret)
						: null,
				}));

				wide.add({
					mcp_connected_count: mcpServers.length,
					mcp_names: mcpServers.map((s) => s.name),
				});
			} else {
				wide.add({ mcp_skipped_no_session: true });
			}
		} catch {
			wide.add({ mcp_fetch_error: true });
			// Continue without MCP servers if there's an error
		}
	}

	const model = models.find((model) => model.id === modelId);
	if (!model) {
		endWide(400, "error", new Error(`Model ${modelId} not found`));
		return NextResponse.json(
			{ error: `Model ${modelId} not found.` },
			{ status: 400 },
		);
	}

	const provider = modelId.split("/")[0]?.toLowerCase();
	if (
		(provider === "openai" && !env.OPENAI_API_KEY) ||
		(provider === "anthropic" && !env.ANTHROPIC_API_KEY)
	) {
		const missingKey =
			provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
		endWide(503, "error", new Error(`${missingKey} is not configured`), {
			error_type: "provider_api_key_missing",
			ai_provider: provider,
			missing_env_key: missingKey,
		});
		return NextResponse.json(
			{
				error:
					"AI provider is not configured on the server. Please add the required API key.",
				code: "provider_api_key_missing",
				provider,
				missingKey,
			},
			{ status: 503 },
		);
	}

	// If projectId is provided, verify it exists (but don't block the stream)
	let project = null;
	if (projectId) {
		project = await getProjectById(projectId);
		if (!project) {
			endWide(404, "error", new Error(`Project ${projectId} not found`), {
				project_id: projectId,
				error_type: "project_not_found",
			});
			return NextResponse.json(
				{ error: `Project ${projectId} not found.` },
				{ status: 404 },
			);
		}

		const session = await getSessionFromReq(req);
		wide.add({
			auth_user_id: session?.user?.id ?? null,
			project_owner_id: project.userId,
			project_visibility: project.visibility,
			is_owner: project.userId === session?.user?.id,
		});
		if (!session?.user?.id) {
			endWide(401, "error", new Error("Authentication required"), {
				project_id: projectId,
				error_type: "authentication_required",
				denial_reason: "missing_session",
			});
			return NextResponse.json(
				{ error: "Authentication required." },
				{ status: 401 },
			);
		}
		if (project.userId !== session.user.id) {
			endWide(403, "error", new Error("Forbidden"), {
				project_id: projectId,
				user_id: session.user.id,
				error_type: "forbidden",
				denial_reason: "owner_mismatch",
			});
			return NextResponse.json({ error: "Forbidden." }, { status: 403 });
		}

		const isInternalRun = req.headers.get("x-chat-internal-run") === "1";
		if (shouldRunInBackground && !isInternalRun) {
			const runId = crypto.randomUUID();
			try {
				await createProjectRun({
					runId,
					projectId,
					userId: session.user.id,
					status: "processing",
				});
			} catch (error) {
				wide.add({
					background_run_fallback: false,
					background_run_error:
						error instanceof Error ? error.message : String(error),
					run_id: runId,
				});
				endWide(503, "error", error, {
					project_id: projectId,
					background_run_started: false,
					run_id: runId,
				});
				return NextResponse.json(
					{
						error: "Background run persistence unavailable.",
						code: "background_run_unavailable",
					},
					{ status: 503 },
				);
			}

			const origin = new URL(req.url).origin;
			const cookieHeader = req.headers.get("cookie") ?? "";
			const authorizationHeader = req.headers.get("authorization") ?? "";

			const runInBackground = async () => {
				const controller = new AbortController();
				const timeout = setTimeout(
					() => controller.abort(),
					BACKGROUND_RUN_TIMEOUT_MS,
				);
				try {
					const response = await fetch(`${origin}/api/chat`, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-chat-internal-run": "1",
							...(cookieHeader ? { cookie: cookieHeader } : {}),
							...(authorizationHeader
								? { authorization: authorizationHeader }
								: {}),
						},
						body: JSON.stringify({
							...body,
							background: false,
						}),
						signal: controller.signal,
					});
					const summary = await readResponsePreview(
						response,
						BACKGROUND_RUN_PREVIEW_CHARS,
					);

					await updateProjectRun(runId, {
						status: response.ok ? "completed" : "error",
						summary: response.ok ? summary : null,
						error: response.ok
							? null
							: summary ||
								`Internal chat run failed with status ${response.status}`,
					});
				} catch (error) {
					await updateProjectRun(runId, {
						status: "error",
						error: error instanceof Error ? error.message : String(error),
					});
				} finally {
					clearTimeout(timeout);
				}
			};

			// In local dev, execute immediately; in production keep using `after`.
			if (process.env.NODE_ENV === "development") {
				void runInBackground();
			} else {
				after(runInBackground);
			}

			endWide(202, "success", undefined, {
				project_id: projectId,
				background_run_started: true,
				run_id: runId,
			});
			return NextResponse.json(
				{
					background: true,
					runId,
					status: "processing",
				},
				{ status: 202 },
			);
		}
	}

	return createUIMessageStreamResponse({
		consumeSseStream: consumeStream,
		stream: createUIMessageStream({
			originalMessages: validatedMessages,
			execute: async ({ writer }) => {
				// Initialize MCP clients and collect tools
				const mcpClients: Array<
					Awaited<ReturnType<typeof experimental_createMCPClient>>
				> = [];
				let mcpTools: Record<string, unknown> = {};

				if (mcpServers.length > 0) {
					try {
						const serverConnections = await Promise.all(
							mcpServers.map(async (server) => {
								try {
									if (server.type === "local" && server.command) {
										const commandValidation = validateLocalMcpCommand(
											server.command,
										);
										if (!commandValidation.valid) {
											wide.add({
												mcp_server_rejected: true,
												mcp_server_name: server.name,
												mcp_server_reason: commandValidation.reason,
											});
											return null;
										}

										// Local STDIO server
										const commandParts = server.command.split(/\s+/);
										const [command, ...args] = commandParts;

										const { Experimental_StdioMCPTransport } = await import(
											"@ai-sdk/mcp/mcp-stdio"
										);

										const client = await experimental_createMCPClient({
											transport: new Experimental_StdioMCPTransport({
												command,
												args,
												env: server.env || {},
											}),
										});

										const serverTools = await client.tools();
										return { client, serverTools };
									}

									if (server.type === "remote" && server.baseUrl) {
										const urlValidation = validateRemoteMcpUrl(server.baseUrl);
										if (!urlValidation.valid) {
											wide.add({
												mcp_server_rejected: true,
												mcp_server_name: server.name,
												mcp_server_reason: urlValidation.reason,
											});
											return null;
										}

										// Remote HTTP/SSE server
										const headers: Record<string, string> = {};
										if (server.oauthClientSecret) {
											headers.Authorization = `Bearer ${server.oauthClientSecret}`;
										}
										if (server.oauthClientId) {
											headers["X-Client-ID"] = server.oauthClientId;
										}

										// Determine transport type based on URL
										const url = new URL(server.baseUrl);
										const isSSE =
											url.pathname.includes("/sse") ||
											server.baseUrl.includes("/sse");

										const client = await experimental_createMCPClient({
											transport: {
												type: isSSE ? "sse" : "http",
												url: server.baseUrl,
												...(Object.keys(headers).length > 0 ? { headers } : {}),
											},
										});

										const serverTools = await client.tools();
										return { client, serverTools };
									}

									return null;
								} catch {
									wide.add({
										mcp_server_connect_error: true,
										mcp_server_name: server.name,
									});
									// Continue with other servers
									return null;
								}
							}),
						);

						for (const connection of serverConnections) {
							if (!connection) {
								continue;
							}
							mcpTools = { ...mcpTools, ...connection.serverTools };
							mcpClients.push(connection.client);
						}

						wide.add({
							mcp_tools_count: Object.keys(mcpTools).length,
						});
					} catch {
						wide.add({ mcp_init_error: true });
						// Continue without MCP if initialization fails
					}
				}

				let activeSandboxId: string | null =
					project?.sandboxId ?? extractSandboxIdFromMessages(validatedMessages);
				if (!project?.sandboxId && activeSandboxId) {
					wide.add({ active_sandbox_hydrated_from_messages: true });
				}
				const allowNewSandboxCreation = projectId
					? !project?.sandboxId &&
						isInitialProjectGenerationTurn(validatedMessages)
					: true;
				wide.add({ allow_new_sandbox_creation: allowNewSandboxCreation });
				const singletonToolUses = new Set<string>();
				const recentToolSignatures: string[] = [];
				const toolFailureState = new Map<
					string,
					{ consecutiveFailures: number; coolingDown: boolean }
				>();
				const isDuplicateToolInput = (toolName: string, input: unknown) => {
					const signature = `${toolName}:${JSON.stringify(input)}`;
					const seenCount = recentToolSignatures.reduce(
						(count, item) => count + (item === signature ? 1 : 0),
						0,
					);
					recentToolSignatures.push(signature);
					if (recentToolSignatures.length > 40) {
						recentToolSignatures.shift();
					}
					return seenCount >= 2;
				};
				const canUseTool = (toolName: string): boolean => {
					const state = toolFailureState.get(toolName);
					return !state?.coolingDown;
				};
				const recordToolOutcome = (
					toolName: string,
					outcome: "success" | "failure",
				) => {
					const current = toolFailureState.get(toolName) ?? {
						consecutiveFailures: 0,
						coolingDown: false,
					};
					if (outcome === "success") {
						toolFailureState.set(toolName, {
							consecutiveFailures: 0,
							coolingDown: false,
						});
						return;
					}
					const consecutiveFailures = current.consecutiveFailures + 1;
					const coolingDown =
						consecutiveFailures >= TOOL_COOLDOWN_FAILURE_THRESHOLD;
					toolFailureState.set(toolName, {
						consecutiveFailures,
						coolingDown,
					});
					if (coolingDown) {
						wide.add({
							tool_cooldown_triggered: true,
							tool_name: toolName,
							consecutive_failures: consecutiveFailures,
						});
					}
				};

				// Combine regular tools with MCP tools
				const toolContext = {
					projectId: projectId ?? undefined,
					userId: project?.userId ?? undefined,
					sandboxDuration,
					permissionMode,
					allowNewSandboxCreation,
					getActiveSandboxId: () => activeSandboxId,
					setActiveSandboxId: (sandboxId: string) => {
						activeSandboxId = sandboxId;
					},
					registerSingletonToolUse: (toolName: string) => {
						if (singletonToolUses.has(toolName)) return false;
						singletonToolUses.add(toolName);
						return true;
					},
					isDuplicateToolInput,
					canUseTool,
					recordToolOutcome,
					updateProject: async (updates: Record<string, unknown>) => {
						if (typeof updates.sandboxId === "string") {
							activeSandboxId = updates.sandboxId;
						}
						if (projectId) {
							await updateProject(projectId, updates);
						}
					},
				};

				// Combine regular tools with MCP tools
				const baseTools = tools({
					modelId,
					writer,
					context: toolContext,
				});

				const allTools = { ...baseTools, ...mcpTools };
				const providerWebSearchTools =
					webSearch && provider === "openai"
						? {
								web_search: openaiProvider.tools.webSearch({
									searchContextSize: "low",
								}),
							}
						: webSearch && provider === "anthropic"
							? {
									web_search: anthropicProvider.tools.webSearch_20250305({}),
								}
							: {};
				const enabledTools = {
					...allTools,
					...providerWebSearchTools,
				};

				wide.add({
					base_tools_count: Object.keys(baseTools).length,
					all_tools_count: Object.keys(allTools).length,
					web_search_enabled: webSearch,
					web_search_tools_count: Object.keys(providerWebSearchTools).length,
					enabled_tools_count: Object.keys(enabledTools).length,
				});

				if (projectId) {
					try {
						await updateProject(projectId, {
							status: "processing",
							progress: 10,
						});
					} catch {
						wide.add({ project_status_processing_update_failed: true });
					}
				}

				const { messages: sanitizedMessages, stats: sanitizationStats } =
					sanitizeMessagesForModel(validatedMessages);
				const { messages: compactedMessages, stats: compactionStats } =
					compactMessagesForModel(sanitizedMessages);
				const {
					messages: preparedContextMessages,
					stats: contextPreparationStats,
					relevantPaths,
				} = prepareMessagesForAgent(compactedMessages);
				let contextMessages = preparedContextMessages;
				let lruContentInjected = false;
				let lruContextFilesCount = 0;
				let lruContextCharsTotal = 0;

				if (activeSandboxId && relevantPaths.length > 0) {
					const lruFiles = await readRecentFileContentsFromSandbox(
						activeSandboxId,
						relevantPaths,
					);
					if (lruFiles.length > 0) {
						const withFileContents = injectRelevantFileContentMessage(
							preparedContextMessages,
							lruFiles,
						);
						contextMessages = withFileContents.messages;
						lruContentInjected = withFileContents.injected;
						lruContextFilesCount = lruFiles.length;
						lruContextCharsTotal = lruFiles.reduce(
							(sum, file) => sum + file.content.length,
							0,
						);
					}
				}
				wide.add({
					messages_compacted_count: compactionStats.compactedMessagesCount,
					compaction_dropped_reasoning_parts:
						compactionStats.droppedReasoningParts,
					compaction_replaced_file_parts: compactionStats.replacedFileParts,
					compaction_truncated_text_parts: compactionStats.truncatedTextParts,
					compaction_truncated_tool_outputs:
						compactionStats.truncatedToolOutputs,
					compaction_truncated_chars_total: compactionStats.truncatedCharsTotal,
					context_budget_collapsed_messages:
						contextPreparationStats.collapsedMessagesByBudget,
					context_relevant_files_count:
						contextPreparationStats.relevantFilesCount,
					context_relevant_files_injected:
						contextPreparationStats.injectedRelevantFilesMessage,
					context_lru_file_content_injected: lruContentInjected,
					context_lru_file_count: lruContextFilesCount,
					context_lru_file_chars_total: lruContextCharsTotal,
					sanitized_assistant_parts: sanitizationStats.sanitizedAssistantParts,
					sanitized_blocked_protected_mutations:
						sanitizationStats.blockedProtectedMutations,
				});
				if (compactionStats.truncatedCharsTotal > 0) {
					wide.add({ ws_payload_guard_active: true });
				}

				const modelMessages = await convertToModelMessages(
					contextMessages.map((message) => {
						return {
							...message,
							parts: message.parts.map((part) => {
								if (part.type === "data-report-errors") {
									const summary = truncateString(
										part.data.summary ?? "",
										MAX_REPORT_ERRORS_SUMMARY_CHARS,
									).text;
									const paths = (part.data.paths ?? []).slice(
										0,
										MAX_REPORT_ERRORS_PATHS,
									);
									return {
										type: "text",
										text:
											`There are errors in the generated code. This is the summary of the errors we have:\n` +
											`\`\`\`${summary}\`\`\`\n` +
											(paths.length
												? `The following files may contain errors:\n` +
													`\`\`\`${paths.join("\n")}\`\`\`\n`
												: "") +
											`Fix the errors reported.`,
									};
								}
								return part;
							}),
						};
					}),
				);

				const prunedMessages = pruneMessages({
					messages: modelMessages,
					reasoning: "before-last-message",
					toolCalls: "before-last-2-messages",
					emptyMessages: "remove",
				});

				wide.add({
					model_messages_count: modelMessages.length,
					pruned_messages_count: prunedMessages.length,
				});

				const toolsDisabledFromRepeatedErrors =
					hasRepeatedToolFailures(validatedMessages);
				if (toolsDisabledFromRepeatedErrors) {
					wide.add({ tools_disabled_from_repeated_errors: true });
					writer.write({
						type: "data-report-errors",
						data: {
							summary:
								"Repeated tool failures detected in recent steps. I will stop calling tools in this turn and provide a focused recovery response.",
							paths: [],
						},
					});
				}

				let mcpClientsClosed = false;
				const stepStartedAt = new Map<number, number>();
				let stepCount = 0;
				let stepTotalDurationMs = 0;
				let stepTotalOutputTokens = 0;
				const closeMcpClients = async () => {
					if (mcpClientsClosed) return;
					mcpClientsClosed = true;
					await Promise.all(
						mcpClients.map((client) =>
							client.close().catch(() => {
								wide.add({ mcp_client_close_error: true });
							}),
						),
					);
				};

				const agent = new ToolLoopAgent({
					...getModelOptions(modelId, { reasoningEffort }),
					instructions: buildAgentInstructions(prompt, validatedMessages),
					stopWhen: stepCountIs(16),
					tools: toolsDisabledFromRepeatedErrors ? {} : enabledTools,
					experimental_onStepStart: ({ stepNumber }) => {
						stepStartedAt.set(stepNumber, Date.now());
					},
					onStepFinish: ({ stepNumber, usage }) => {
						const startedAt = stepStartedAt.get(stepNumber);
						if (startedAt) {
							stepTotalDurationMs += Date.now() - startedAt;
							stepStartedAt.delete(stepNumber);
						}
						stepCount += 1;
						stepTotalOutputTokens += usage.outputTokens ?? 0;
					},
					onFinish: async () => {
						wide.add({
							agent_step_count: stepCount,
							agent_step_total_duration_ms: stepTotalDurationMs,
							agent_step_total_output_tokens: stepTotalOutputTokens,
							agent_step_avg_duration_ms:
								stepCount > 0 ? Math.round(stepTotalDurationMs / stepCount) : 0,
						});
						await closeMcpClients();
					},
				});

				let result: Awaited<ReturnType<typeof agent.stream>>;
				try {
					result = await agent.stream({
						prompt: prunedMessages,
					});
				} catch (error) {
					wide.add({ ai_error: true });

					if (projectId) {
						await updateProject(projectId, {
							status: "error",
							progress: 0,
						});
					}

					await closeMcpClients();
					endWide(500, "error", error);
					throw error;
				}

				writer.merge(
					result.toUIMessageStream({
						sendStart: false,
						sendReasoning: true,
						messageMetadata: ({ part }) => {
							// Send metadata when streaming completes
							if (part.type === "finish") {
								const usage = part.totalUsage;
								return {
									model: model.name,
									usage,
									stepStats: {
										count: stepCount,
										totalDurationMs: stepTotalDurationMs,
										avgDurationMs:
											stepCount > 0
												? Math.round(stepTotalDurationMs / stepCount)
												: 0,
										totalOutputTokens: stepTotalOutputTokens,
									},
								};
							}
						},
						onFinish: async ({
							messages: streamMessages,
							responseMessage,
							isContinuation,
						}) => {
							await closeMcpClients();

							// Log message parts to debug tool calls
							const completedMessages = (() => {
								if (isContinuation && validatedMessages.length > 0) {
									return [
										...validatedMessages.slice(0, validatedMessages.length - 1),
										responseMessage as ChatUIMessage,
									];
								}

								return [...validatedMessages, responseMessage as ChatUIMessage];
							})();
							const assistantMessages = completedMessages.filter(
								(msg) => msg.role === "assistant",
							);
							const latestAssistantMessage =
								assistantMessages[assistantMessages.length - 1];
							// Save complete UI message history to database if projectId is provided
							if (projectId) {
								try {
									const persistedMessages = compactMessagesForPersistence(
										reconcileIncompleteTaskMessages(completedMessages).messages,
									);
									wide.add({
										persisted_message_count: persistedMessages.length,
										stream_message_count: streamMessages.length,
										completed_message_count: completedMessages.length,
									});
									await replaceProjectMessages({
										projectId,
										uiMessages: persistedMessages,
									});

									await updateProject(projectId, {
										status: "completed",
										progress: 100,
									});

									// Enrich usage with TokenLens and persist to database
									if (latestAssistantMessage?.metadata?.usage) {
										const baseUsage = latestAssistantMessage.metadata.usage;
										let enrichedUsage: AppUsage = baseUsage;

										try {
											const providers = await getTokenlensCatalog();
											const modelId = model.id;

											if (modelId && providers) {
												const summary = getUsage({
													modelId,
													usage: baseUsage,
													providers,
												});
												enrichedUsage = {
													...baseUsage,
													...summary,
													modelId,
												} as AppUsage;
											} else {
												enrichedUsage = { ...baseUsage, modelId } as AppUsage;
											}
										} catch {
											wide.add({ tokenlens_enrichment_failed: true });
											enrichedUsage = {
												...baseUsage,
												modelId: model.id,
											} as AppUsage;
										}

										// Persist enriched usage to database
										await updateProjectLastContext(projectId, enrichedUsage);
										wide.add({
											usage_total_tokens: enrichedUsage.totalTokens,
										});
									}
								} catch {
									wide.add({ replace_project_messages_error: true });

									// Update project status to error if message saving fails
									await updateProject(projectId, {
										status: "error",
										progress: 0,
									});
								}
							}
							endWide(200, "success");
						},
					}),
				);
			},
		}),
	});
}

function hasRepeatedToolFailures(messages: ChatUIMessage[]): boolean {
	const recentStatuses: Array<"loading" | "done" | "error"> = [];
	const maxAssistantMessagesToScan = 3;
	let scannedAssistantMessages = 0;

	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		scannedAssistantMessages += 1;
		for (let j = message.parts.length - 1; j >= 0; j -= 1) {
			const part = message.parts[j];
			if (part.type !== "data-task-coding-v1") continue;
			recentStatuses.push(part.data.status);
		}
		if (scannedAssistantMessages >= maxAssistantMessagesToScan) break;
	}

	let consecutiveErrors = 0;
	for (const status of recentStatuses) {
		if (status !== "error") break;
		consecutiveErrors += 1;
		if (consecutiveErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
			return true;
		}
	}

	return false;
}

function buildAgentInstructions(
	basePrompt: string,
	messages: ChatUIMessage[],
): string {
	const progressNarration = `
Progress narration requirement for this turn:
- Before each major tool action, send one short user-facing sentence describing what you are about to do.
- After each major result (success or failure), send one short sentence describing outcome and next action.
- Keep each update under 20 words and avoid repeating the same sentence.`.trim();

	if (!isBuildIntentTurn(messages)) {
		return `${basePrompt}

${progressNarration}`;
	}

	return `${basePrompt}

${progressNarration}

Hard requirement for this turn:
- This is a build/generation request. You must implement via tools in sandbox.
- Do not return chat-only code snippets or instructions as the final answer.
- Use tools to create/update files and run commands as needed before final text.
- If a tool fails, report the error briefly and retry with a different concrete tool step.`;
}

function isBuildIntentTurn(messages: ChatUIMessage[]): boolean {
	const latestUser = [...messages]
		.reverse()
		.find((message) => message.role === "user");
	if (!latestUser) return false;

	const text = latestUser.parts
		.filter(
			(
				part,
			): part is Extract<(typeof latestUser.parts)[number], { type: "text" }> =>
				part.type === "text",
		)
		.map((part) => part.text ?? "")
		.join(" ")
		.toLowerCase();

	if (!text.trim()) return false;

	return (
		/\b(create|build|generate|scaffold|make)\b/.test(text) &&
		/\b(app|website|site|page|project|landing|html)\b/.test(text)
	);
}

function isInitialProjectGenerationTurn(messages: ChatUIMessage[]): boolean {
	const assistantCount = messages.filter(
		(message) => message.role === "assistant",
	).length;
	if (assistantCount > 0) return false;

	const userMessages = messages.filter((message) => message.role === "user");
	if (userMessages.length !== 1) return false;

	const firstUserMessage = userMessages[0];
	return firstUserMessage.parts.some(
		(part) =>
			part.type === "text" &&
			typeof part.text === "string" &&
			part.text.trim().length > 0,
	);
}

function extractSandboxIdFromMessages(
	messages: ChatUIMessage[],
): string | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		for (let j = message.parts.length - 1; j >= 0; j -= 1) {
			const part = message.parts[j];
			if (part.type === "data-task-coding-v1") {
				const parts = part.data.parts;
				const lastPart = parts[parts.length - 1];
				if (
					lastPart &&
					typeof lastPart === "object" &&
					"type" in lastPart &&
					lastPart.type === "create-sandbox-complete" &&
					"sandboxId" in lastPart &&
					typeof lastPart.sandboxId === "string"
				) {
					return lastPart.sandboxId;
				}
			}

			if (
				part.type === "tool-createSandbox" &&
				part.state === "output-available"
			) {
				const output = (part as { output?: unknown }).output;
				if (
					output &&
					typeof output === "object" &&
					"sandboxId" in output &&
					typeof output.sandboxId === "string"
				) {
					return output.sandboxId;
				}
				if (typeof output === "string") {
					const match = output.match(/sbx_[a-zA-Z0-9_-]+/);
					if (match) return match[0];
				}
			}
		}
	}
	return null;
}

async function readRecentFileContentsFromSandbox(
	sandboxId: string,
	paths: string[],
): Promise<RelevantFileContent[]> {
	const safePaths = filterPathsForLruContext(paths).slice(
		0,
		MAX_LRU_FILE_CONTEXT_FILES,
	);
	if (safePaths.length === 0) return [];

	let sandbox: Sandbox;
	try {
		const creds = getSandboxCredentials();
		sandbox = await Sandbox.get({
			sandboxId,
			...creds,
		});
	} catch {
		return [];
	}

	const files: RelevantFileContent[] = [];
	let totalChars = 0;

	for (const path of safePaths) {
		if (totalChars >= MAX_LRU_FILE_CONTEXT_TOTAL_CHARS) break;
		const remaining = MAX_LRU_FILE_CONTEXT_TOTAL_CHARS - totalChars;
		const maxForFile = Math.min(MAX_LRU_FILE_CONTEXT_CHARS_PER_FILE, remaining);
		const content = await readSandboxFileText(sandbox, path, maxForFile);
		if (!content) continue;

		files.push({ path, content });
		totalChars += content.length;
	}

	return files;
}

function filterPathsForLruContext(paths: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const rawPath of paths) {
		const path = rawPath.trim();
		if (!path || seen.has(path)) continue;
		if (path.startsWith("...and ")) continue;
		if (isProtectedMutationPath(path)) continue;
		if (isLikelyBinaryPath(path)) continue;

		seen.add(path);
		result.push(path);
	}

	return result;
}

function isLikelyBinaryPath(path: string): boolean {
	const lowered = path.toLowerCase();
	return [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".webp",
		".ico",
		".pdf",
		".zip",
		".tar",
		".gz",
		".woff",
		".woff2",
		".ttf",
		".mp4",
		".mov",
		".webm",
	].some((ext) => lowered.endsWith(ext));
}

async function readSandboxFileText(
	sandbox: Sandbox,
	path: string,
	maxChars: number,
): Promise<string | null> {
	try {
		const stream = await sandbox.readFile({ path });
		if (!stream) return null;

		const decoder = new TextDecoder();
		let text = "";
		for await (const chunk of stream) {
			if (typeof chunk === "string") {
				text += chunk;
			} else {
				text += decoder.decode(chunk, { stream: true });
			}
			if (text.length > maxChars) {
				return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
			}
		}
		return text;
	} catch {
		return null;
	}
}
