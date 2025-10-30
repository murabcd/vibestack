import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { unstable_cache as cache } from "next/cache";
import { NextResponse } from "next/server";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { ChatUIMessage } from "@/components/chat/types";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import { getAvailableModels, getModelOptions } from "@/lib/ai/gateway";
import { tools } from "@/lib/ai/tools";
import type { AppUsage } from "@/lib/ai/usage";
import {
	getMessagesByProjectId,
	getProjectById,
	saveMessages,
	updateProject,
	updateProjectLastContext,
} from "@/lib/db/queries";
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
}

export async function POST(req: Request) {
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
	} = body;

	// Debug logging removed for production

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
			execute: ({ writer }) => {
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
					tools: tools({
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
					}),
					onError: async (error) => {
						console.error("Error communicating with AI");
						console.error(JSON.stringify(error, null, 2));

						// Update project status to error
						if (projectId) {
							await updateProject(projectId, {
								status: "error",
								progress: 0,
							});
						}
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
							// Save assistant message to database if projectId is provided
							// (User message was already saved before streaming started)
							if (projectId) {
								try {
									// Get the latest assistant message
									const assistantMessages = allMessages.filter(
										(msg) => msg.role === "assistant",
									);
									const latestAssistantMessage =
										assistantMessages[assistantMessages.length - 1];

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
