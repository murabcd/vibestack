import { experimental_createMCPClient } from "@ai-sdk/mcp";
import {
	consumeStream,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { and, eq, inArray } from "drizzle-orm";
import { unstable_cache as cache } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { ChatUIMessage } from "@/components/chat/types";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import { getAvailableModels, getModelOptions } from "@/lib/ai/gateway";
import { tools } from "@/lib/ai/tools";
import type { AppUsage } from "@/lib/ai/usage";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/index";
import {
	getProjectById,
	replaceProjectMessages,
	updateProject,
	updateProjectLastContext,
} from "@/lib/db/queries";
import { connectors } from "@/lib/db/schema";
import { logger } from "@/lib/logging/logger";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSessionFromReq } from "@/lib/session/server";
import prompt from "./prompt.md";

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
	reasoningEffort?: "low" | "medium";
	projectId?: string;
	sandboxDuration?: number;
	mcpServerIds?: string[];
}

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
		checkBotId(),
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
		reasoningEffort,
		projectId,
		sandboxDuration,
		mcpServerIds,
	} = body;

	wide.add({
		model_id: modelId,
		project_id: projectId,
		message_count: messages.length,
		mcp_server_ids_count: mcpServerIds?.length ?? 0,
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

	// If projectId is provided, verify it exists (but don't block the stream)
	let project = null;
	if (projectId) {
		project = await getProjectById(projectId);
		if (!project) {
			endWide(404, "error", new Error(`Project ${projectId} not found`), {
				project_id: projectId,
			});
			return NextResponse.json(
				{ error: `Project ${projectId} not found.` },
				{ status: 404 },
			);
		}
	}

	return createUIMessageStreamResponse({
		consumeSseStream: consumeStream,
		stream: createUIMessageStream({
			originalMessages: messages,
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

				// Combine regular tools with MCP tools
				const baseTools = tools({
					modelId,
					writer,
					context:
						projectId && project
							? {
									projectId,
									userId: project.userId,
									sandboxDuration,
									updateProject: async (updates) => {
										await updateProject(projectId, updates);
									},
								}
							: undefined,
				});

				const allTools = { ...baseTools, ...mcpTools };

				wide.add({
					base_tools_count: Object.keys(baseTools).length,
					all_tools_count: Object.keys(allTools).length,
				});

				const result = streamText({
					...getModelOptions(modelId, { reasoningEffort }),
					system: prompt,
					messages: await convertToModelMessages(
						messages.map((message) => {
							message.parts = message.parts.map((part) => {
								if (part.type === "data-report-errors") {
									return {
										type: "text",
										text:
											`There are errors in the generated code. This is the summary of the errors we have:\n` +
											`\`\`\`${part.data.summary}\`\`\`\n` +
											(part.data.paths?.length
												? `The following files may contain errors:\n` +
													`\`\`\`${part.data.paths?.join("\n")}\`\`\`\n`
												: "") +
											`Fix the errors reported.`,
									};
								}
								return part;
							});
							return message;
						}),
					),
					stopWhen: stepCountIs(20),
					tools: allTools,
					onError: async (error) => {
						wide.add({ ai_error: true });

						// Update project status to error
						if (projectId) {
							await updateProject(projectId, {
								status: "error",
								progress: 0,
							});
						}

						// Close MCP clients on error
						await Promise.all(
							mcpClients.map((client) =>
								client.close().catch(() => {
									wide.add({ mcp_client_close_error: true });
								}),
							),
						);
						endWide(500, "error", error);
					},
					onFinish: async () => {
						// Close MCP clients when streamText finishes
						await Promise.all(
							mcpClients.map((client) =>
								client.close().catch(() => {
									wide.add({ mcp_client_close_error: true });
								}),
							),
						);
					},
				});

				writer.merge(
					result.toUIMessageStream({
						sendReasoning: true,
						sendStart: false,
						messageMetadata: ({ part }) => {
							// Send metadata when streaming completes
							if (part.type === "finish") {
								const usage = part.totalUsage;
								return {
									model: model.name,
									usage,
								};
							}
						},
						onFinish: async ({ messages: allMessages }) => {
							// Close MCP clients when finished
							await Promise.all(
								mcpClients.map((client) =>
									client.close().catch(() => {
										wide.add({ mcp_client_close_error: true });
									}),
								),
							);

							// Log message parts to debug tool calls
							const assistantMessages = allMessages.filter(
								(msg) => msg.role === "assistant",
							);
							const latestAssistantMessage =
								assistantMessages[assistantMessages.length - 1];

							// Save complete UI message history to database if projectId is provided
							if (projectId) {
								try {
									await replaceProjectMessages({
										projectId,
										uiMessages: allMessages,
									});

									// Update project status to completed
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
