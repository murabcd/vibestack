import { experimental_createMCPClient } from "@ai-sdk/mcp";
import {
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
	saveMessages,
	updateProject,
	updateProjectLastContext,
} from "@/lib/db/queries";
import { connectors } from "@/lib/db/schema";
import { getSessionFromReq } from "@/lib/session/server";
import prompt from "./prompt.md";

const getTokenlensCatalog = cache(
	async (): Promise<ModelCatalog | undefined> => {
		try {
			return await fetchModels();
		} catch (err) {
			console.warn(
				"TokenLens: catalog fetch failed, using default catalog",
				err,
			);
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
	// Parallelize bot check, model fetching, and request parsing for faster startup
	const [checkResult, models, body] = await Promise.all([
		checkBotId(),
		getAvailableModels(),
		req.json() as Promise<BodyData>,
	]);

	if (checkResult.isBot) {
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

	console.log("[Chat API] Request received:", {
		modelId,
		projectId,
		mcpServerIds,
		messageCount: messages.length,
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
			console.log("[Chat API] Fetching MCP servers with IDs:", mcpServerIds);
			const session = await getSessionFromReq(req);

			if (session?.user?.id) {
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

				console.log("[Chat API] Found connectors:", userConnectors.length);

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

				console.log(
					"[Chat API] Decrypted MCP servers:",
					mcpServers.map((s) => s.name),
				);
			} else {
				console.log("[Chat API] No session found, skipping MCP servers");
			}
		} catch (error) {
			console.error("[Chat API] Error fetching MCP servers:", error);
			// Continue without MCP servers if there's an error
		}
	}

	const model = models.find((model) => model.id === modelId);
	if (!model) {
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
			return NextResponse.json(
				{ error: `Project ${projectId} not found.` },
				{ status: 404 },
			);
		}

		// Save user message IMMEDIATELY before streaming starts
		// This ensures the message is persisted even if user closes tab mid-stream
		const latestUserMessage = messages[messages.length - 1];
		if (latestUserMessage && latestUserMessage.role === "user") {
			try {
				await saveMessages({
					messages: [
						{
							projectId,
							role: "user" as const,
							content: latestUserMessage.parts,
						},
					],
				});
			} catch (error) {
				console.error("Failed to save user message:", error);
				// Don't block the stream - just log the error
			}
		}
	}

	return createUIMessageStreamResponse({
		stream: createUIMessageStream({
			originalMessages: messages,
			execute: async ({ writer }) => {
				// Initialize MCP clients and collect tools
				const mcpClients: Array<
					Awaited<ReturnType<typeof experimental_createMCPClient>>
				> = [];
				let mcpTools: Record<string, unknown> = {};

				if (mcpServers.length > 0) {
					console.log(
						"[Chat API] Initializing MCP clients:",
						mcpServers.length,
					);

					try {
						for (const server of mcpServers) {
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
									console.log(
										"[Chat API] Local MCP server tools:",
										server.name,
										Object.keys(serverTools),
									);
									mcpTools = { ...mcpTools, ...serverTools };
									mcpClients.push(client);
									console.log(
										"[Chat API] Connected to local MCP server:",
										server.name,
									);
								} else if (server.type === "remote" && server.baseUrl) {
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
									console.log(
										"[Chat API] Remote MCP server tools:",
										server.name,
										Object.keys(serverTools),
									);
									mcpTools = { ...mcpTools, ...serverTools };
									mcpClients.push(client);
									console.log(
										"[Chat API] Connected to remote MCP server:",
										server.name,
										isSSE ? "SSE" : "HTTP",
									);
								}
							} catch (serverError) {
								console.error(
									`[Chat API] Failed to connect to MCP server ${server.name}:`,
									serverError,
								);
								// Continue with other servers
							}
						}

						console.log(
							"[Chat API] MCP tools loaded:",
							Object.keys(mcpTools).length,
						);
					} catch (mcpError) {
						console.error(
							"[Chat API] Error initializing MCP clients:",
							mcpError,
						);
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

				console.log("[Chat API] Base tools:", Object.keys(baseTools));
				console.log(
					"[Chat API] MCP tools count:",
					Object.keys(mcpTools).length,
				);
				console.log("[Chat API] All tools combined:", Object.keys(allTools));
				console.log("[Chat API] MCP tool names:", Object.keys(mcpTools));

				const result = streamText({
					...getModelOptions(modelId, { reasoningEffort }),
					system: prompt,
					messages: convertToModelMessages(
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
						console.error("[Chat API] Error communicating with AI");
						console.error(
							"[Chat API] Error details:",
							JSON.stringify(error, null, 2),
						);

						// Update project status to error
						if (projectId) {
							await updateProject(projectId, {
								status: "error",
								progress: 0,
							});
						}

						// Close MCP clients on error
						await Promise.all(
							mcpClients.map((client) => client.close().catch(console.error)),
						);
					},
					onFinish: async () => {
						// Close MCP clients when streamText finishes
						await Promise.all(
							mcpClients.map((client) => client.close().catch(console.error)),
						);
						console.log("[Chat API] Closed MCP clients in streamText onFinish");
					},
				});

				result.consumeStream();
				writer.merge(
					result.toUIMessageStream({
						sendReasoning: true,
						sendStart: false,
						messageMetadata: ({ part }) => {
							// Send metadata when streaming completes
							if (part.type === "finish") {
								const usage = {
									inputTokens: part.totalUsage.inputTokens,
									outputTokens: part.totalUsage.outputTokens,
									totalTokens: part.totalUsage.totalTokens,
									cachedInputTokens: part.totalUsage.cachedInputTokens || 0,
									reasoningTokens: part.totalUsage.reasoningTokens || 0,
								};
								console.log("Creating metadata with usage:", usage);
								return {
									model: model.name,
									usage,
								};
							}
						},
						onFinish: async ({ messages: allMessages }) => {
							// Close MCP clients when finished
							await Promise.all(
								mcpClients.map((client) => client.close().catch(console.error)),
							);
							console.log("[Chat API] Closed MCP clients");

							// Log message parts to debug tool calls
							const assistantMessages = allMessages.filter(
								(msg) => msg.role === "assistant",
							);
							const latestAssistantMessage =
								assistantMessages[assistantMessages.length - 1];

							if (latestAssistantMessage) {
								console.log(
									"[Chat API] Assistant message parts:",
									latestAssistantMessage.parts.map((p) => ({
										type: p.type,
										toolName: "toolName" in p ? p.toolName : undefined,
										toolCallId: "toolCallId" in p ? p.toolCallId : undefined,
									})),
								);
							}

							// Save assistant message to database if projectId is provided
							// (User message was already saved before streaming started)
							if (projectId) {
								try {
									// Save assistant message
									if (latestAssistantMessage) {
										await saveMessages({
											messages: [
												{
													projectId,
													role: "assistant" as const,
													content: latestAssistantMessage.parts,
												},
											],
										});
									}

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
										} catch (err) {
											console.warn("TokenLens enrichment failed", err);
											enrichedUsage = {
												...baseUsage,
												modelId: model.id,
											} as AppUsage;
										}

										// Persist enriched usage to database
										await updateProjectLastContext(projectId, enrichedUsage);
									}
								} catch (error) {
									console.error("Failed to save messages:", error);

									// Update project status to error if message saving fails
									await updateProject(projectId, {
										status: "error",
										progress: 0,
									});
								}
							}
						},
					}),
				);
			},
		}),
	});
}
