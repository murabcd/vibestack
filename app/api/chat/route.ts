import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import type { ChatUIMessage } from "@/components/chat/types";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import { getAvailableModels, getModelOptions } from "@/lib/ai/gateway";
import { tools } from "@/lib/ai/tools";
import {
	getMessagesByProjectId,
	getProjectById,
	saveMessages,
	updateProject,
} from "@/lib/db/queries";
import prompt from "./prompt.md";

interface BodyData {
	messages: ChatUIMessage[];
	modelId?: string;
	reasoningEffort?: "low" | "medium";
	projectId?: string;
}

export async function POST(req: Request) {
	const checkResult = await checkBotId();
	if (checkResult.isBot) {
		return NextResponse.json({ error: `Bot detected` }, { status: 403 });
	}

	const [
		models,
		{ messages, modelId = DEFAULT_MODEL, reasoningEffort, projectId },
	] = await Promise.all([
		getAvailableModels(),
		req.json() as Promise<BodyData>,
	]);

	// Debug logging removed for production

	const model = models.find((model) => model.id === modelId);
	if (!model) {
		return NextResponse.json(
			{ error: `Model ${modelId} not found.` },
			{ status: 400 },
		);
	}

	// If projectId is provided, verify it exists and update status
	if (projectId) {
		const project = await getProjectById(projectId);
		if (!project) {
			return NextResponse.json(
				{ error: `Project ${projectId} not found.` },
				{ status: 404 },
			);
		}

		// Save user's message immediately to database BEFORE streaming
		const userMessages = messages.filter((msg) => msg.role === "user");
		const latestUserMessage = userMessages[userMessages.length - 1];

		if (latestUserMessage) {
			try {
				// Check if this exact message already exists
				const existingMessages = await getMessagesByProjectId(projectId);
				const messageAlreadyExists = existingMessages.some(
					(msg) =>
						msg.role === "user" &&
						JSON.stringify(msg.content) ===
							JSON.stringify(latestUserMessage.parts),
				);

				if (!messageAlreadyExists) {
					await saveMessages({
						messages: [
							{
								projectId,
								role: "user",
								content: latestUserMessage.parts,
							},
						],
					});
				}
			} catch (error) {
				console.error("Failed to save user message:", error);
				// Continue anyway - don't block the stream
			}
		}

		// Set project status to processing
		await updateProject(projectId, {
			status: "processing",
			progress: 0,
		});
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
						context: projectId
							? {
									projectId,
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
							// Save assistant's response to database if projectId is provided
							if (projectId) {
								try {
									// Only save the assistant's response
									const assistantMessages = allMessages.filter(
										(msg) => msg.role === "assistant",
									);
									const latestAssistantMessage =
										assistantMessages[assistantMessages.length - 1];

									if (latestAssistantMessage) {
										await saveMessages({
											messages: [
												{
													projectId,
													role: "assistant",
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
								} catch (error) {
									console.error("Failed to save assistant message:", error);

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
