import type { ChatUIMessage } from "@/components/chat/types";
import { isProtectedMutationPath } from "@/lib/ai/safety/protected-paths";
import { ChatContextManager } from "./chat-context-manager";

export interface CompactionStats {
	compactedMessagesCount: number;
	droppedReasoningParts: number;
	replacedFileParts: number;
	truncatedTextParts: number;
	truncatedToolOutputs: number;
	truncatedCharsTotal: number;
}

const RECENT_MESSAGES_TO_KEEP_FULL = 8;
const MAX_TEXT_PART_CHARS = 4000;
const MAX_TOOL_OUTPUT_CHARS = 1200;
const MAX_CONTEXT_CHARS = 120000;
const MIN_MESSAGES_AFTER_COLLAPSE = 12;
const contextManager = new ChatContextManager();

export interface ContextPreparationStats {
	collapsedMessagesByBudget: number;
	injectedRelevantFilesMessage: boolean;
	relevantFilesCount: number;
}

export interface RelevantFileContent {
	path: string;
	content: string;
}

export interface SanitizationStats {
	sanitizedAssistantParts: number;
	blockedProtectedMutations: number;
}

export interface ReconcileTaskStats {
	reconciledCodingTasks: number;
}

export async function readResponsePreview(
	response: Response,
	maxChars: number,
): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) {
		const text = await response.text();
		return text.slice(0, maxChars);
	}

	const decoder = new TextDecoder();
	let preview = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		// Always drain the stream fully so server-side onFinish hooks run and
		// project messages are persisted, while keeping only a bounded preview.
		if (preview.length < maxChars) {
			preview += decoder.decode(value, { stream: true });
			if (preview.length > maxChars) {
				preview = preview.slice(0, maxChars);
			}
		}
	}
	return preview;
}

export function compactMessagesForModel(messages: ChatUIMessage[]): {
	messages: ChatUIMessage[];
	stats: CompactionStats;
} {
	const stats: CompactionStats = {
		compactedMessagesCount: 0,
		droppedReasoningParts: 0,
		replacedFileParts: 0,
		truncatedTextParts: 0,
		truncatedToolOutputs: 0,
		truncatedCharsTotal: 0,
	};
	const keepFromIndex = Math.max(
		messages.length - RECENT_MESSAGES_TO_KEEP_FULL,
		0,
	);
	const compacted = messages.map((message, index) => {
		const keepFull = index >= keepFromIndex;
		if (!keepFull) {
			stats.compactedMessagesCount += 1;
		}
		return {
			...message,
			parts: message.parts
				.map((part) => compactPartForModel(part, keepFull, stats))
				.filter(
					(part): part is ChatUIMessage["parts"][number] => part !== null,
				),
		};
	});
	return { messages: compacted, stats };
}

export function prepareMessagesForAgent(messages: ChatUIMessage[]): {
	messages: ChatUIMessage[];
	stats: ContextPreparationStats;
	relevantPaths: string[];
} {
	const prepared = contextManager.prepareContext(messages, {
		maxContextChars: MAX_CONTEXT_CHARS,
		minMessagesAfterCollapse: MIN_MESSAGES_AFTER_COLLAPSE,
	});

	return {
		messages: prepared.messages,
		stats: {
			collapsedMessagesByBudget: prepared.collapsedMessagesByBudget,
			injectedRelevantFilesMessage: prepared.injectedRelevantFilesMessage,
			relevantFilesCount: prepared.relevantPaths.length,
		},
		relevantPaths: prepared.relevantPaths,
	};
}

export function injectRelevantFileContentMessage(
	messages: ChatUIMessage[],
	files: RelevantFileContent[],
): {
	messages: ChatUIMessage[];
	injected: boolean;
} {
	if (files.length === 0) return { messages, injected: false };

	const filtered = messages.filter(
		(message) => !message.id.startsWith("context-relevant-files-"),
	);
	const lastUserIndex = findLastUserMessageIndex(filtered);
	if (lastUserIndex === -1) {
		return { messages: filtered, injected: false };
	}

	const text =
		"Relevant file contents recently touched:\n\n" +
		files
			.map((file) => `Path: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
			.join("\n\n") +
		"\n\nPrioritize these files while implementing and fixing issues.";

	const contextMessage: ChatUIMessage = {
		id: `context-relevant-file-contents-${Date.now()}`,
		role: "user",
		parts: [{ type: "text", text }],
	};

	const withContext = [...filtered];
	withContext.splice(lastUserIndex, 0, contextMessage);
	return {
		messages: withContext,
		injected: true,
	};
}

export function sanitizeMessagesForModel(messages: ChatUIMessage[]): {
	messages: ChatUIMessage[];
	stats: SanitizationStats;
} {
	let sanitizedAssistantParts = 0;
	let blockedProtectedMutations = 0;

	const sanitized = messages.map((message) => {
		if (message.role !== "assistant") return message;

		return {
			...message,
			parts: message.parts.map((part) => {
				if (part.type !== "text" && part.type !== "reasoning") return part;
				const originalText = part.text ?? "";
				const cleaned = sanitizeAssistantText(originalText);
				const cleanedText = cleaned.text;
				blockedProtectedMutations += cleaned.blockedMutations;
				if (cleanedText !== originalText) {
					sanitizedAssistantParts += 1;
				}
				return {
					...part,
					text: cleanedText,
				};
			}),
		};
	});

	return {
		messages: sanitized,
		stats: { sanitizedAssistantParts, blockedProtectedMutations },
	};
}

export function reconcileIncompleteTaskMessages(messages: ChatUIMessage[]): {
	messages: ChatUIMessage[];
	stats: ReconcileTaskStats;
} {
	let reconciledCodingTasks = 0;

	const nextMessages = messages.map((message) => {
		if (message.role !== "assistant") return message;
		return {
			...message,
			parts: message.parts.map((part) => {
				if (
					part.type === "data-task-coding-v1" &&
					part.data.status === "loading"
				) {
					reconciledCodingTasks += 1;
					return {
						...part,
						data: {
							...part.data,
							status: "error" as const,
							parts: [
								...part.data.parts,
								{
									type: "task-interrupted",
									message:
										"Previous streaming session ended before this task completed.",
								},
							],
						},
					};
				}
				return part;
			}),
		};
	});

	return {
		messages: nextMessages,
		stats: {
			reconciledCodingTasks,
		},
	};
}

export function compactMessagesForPersistence(
	messages: ChatUIMessage[],
): ChatUIMessage[] {
	const keepFromIndex = Math.max(
		messages.length - RECENT_MESSAGES_TO_KEEP_FULL,
		0,
	);
	return messages.map((message, index) => {
		const keepFull = index >= keepFromIndex;
		return {
			...message,
			parts: message.parts
				.map((part) =>
					compactPartForModel(part, keepFull, {
						compactedMessagesCount: 0,
						droppedReasoningParts: 0,
						replacedFileParts: 0,
						truncatedTextParts: 0,
						truncatedToolOutputs: 0,
						truncatedCharsTotal: 0,
					}),
				)
				.filter(
					(part): part is ChatUIMessage["parts"][number] => part !== null,
				),
		};
	});
}

export function truncateString(
	input: string,
	maxChars: number,
): { text: string; truncatedChars: number } {
	if (input.length <= maxChars) {
		return { text: input, truncatedChars: 0 };
	}
	const truncatedChars = input.length - maxChars;
	return {
		text: `${input.slice(0, maxChars)}\n...[truncated ${truncatedChars} chars]`,
		truncatedChars,
	};
}

function compactPartForModel(
	part: ChatUIMessage["parts"][number],
	keepFull: boolean,
	stats: CompactionStats,
): ChatUIMessage["parts"][number] | null {
	if (part.type === "reasoning" && !keepFull) {
		// Preserve reasoning parts for model continuity (e.g. OpenAI Responses
		// reasoning item chains) while still bounding prompt size.
		const { text, truncatedChars } = truncateString(
			part.text ?? "",
			MAX_TEXT_PART_CHARS,
		);
		if (truncatedChars > 0) {
			stats.truncatedTextParts += 1;
			stats.truncatedCharsTotal += truncatedChars;
		}
		return {
			...part,
			text,
		};
	}

	if (part.type === "text") {
		const { text, truncatedChars } = truncateString(
			part.text ?? "",
			MAX_TEXT_PART_CHARS,
		);
		if (truncatedChars > 0) {
			stats.truncatedTextParts += 1;
			stats.truncatedCharsTotal += truncatedChars;
		}
		return {
			...part,
			text,
		};
	}

	if (part.type === "file" && !keepFull) {
		stats.replacedFileParts += 1;
		return {
			type: "text",
			text: "[Older file attachment omitted for context efficiency.]",
		};
	}

	if ("output" in part && part.output !== undefined) {
		const compacted = compactUnknownValue(part.output);
		if (compacted.truncatedChars > 0) {
			stats.truncatedToolOutputs += 1;
			stats.truncatedCharsTotal += compacted.truncatedChars;
		}
		return {
			...part,
			output: compacted.value,
		} as ChatUIMessage["parts"][number];
	}

	return part;
}

function compactUnknownValue(value: unknown): {
	value: unknown;
	truncatedChars: number;
} {
	if (typeof value === "string") {
		const truncated = truncateString(value, MAX_TOOL_OUTPUT_CHARS);
		return {
			value: truncated.text,
			truncatedChars: truncated.truncatedChars,
		};
	}
	try {
		const serialized = JSON.stringify(value);
		if (!serialized) {
			return { value, truncatedChars: 0 };
		}
		const truncated = truncateString(serialized, MAX_TOOL_OUTPUT_CHARS);
		if (truncated.truncatedChars === 0) {
			return { value, truncatedChars: 0 };
		}
		return {
			value: truncated.text,
			truncatedChars: truncated.truncatedChars,
		};
	} catch {
		return { value, truncatedChars: 0 };
	}
}

function findLastUserMessageIndex(messages: ChatUIMessage[]): number {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i].role === "user") {
			return i;
		}
	}
	return -1;
}

function sanitizeAssistantText(text: string): {
	text: string;
	blockedMutations: number;
} {
	let next = text;
	let blockedMutations = 0;

	next = next.replace(
		/<boltAction\s+type="file"\s+filePath="([^"]+)"[^>]*>[\s\S]*?<\/boltAction>/gi,
		(fullMatch, filePath: string) => {
			if (!isProtectedMutationPath(filePath)) {
				return fullMatch;
			}
			blockedMutations += 1;
			return `Attempted modification of protected file \`${filePath}\` was blocked.`;
		},
	);

	next = next.replace(/<think>[\s\S]*?<\/think>/gi, "");
	next = next.replace(/<div class=\\"__boltThought__\\">[\s\S]*?<\/div>/gi, "");
	return { text: next.trim(), blockedMutations };
}
