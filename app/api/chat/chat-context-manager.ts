import type { ChatUIMessage } from "@/components/chat/types";

const MAX_RELEVANT_PATHS = 24;

export interface ChatContextPreparationOptions {
	maxContextChars: number;
	minMessagesAfterCollapse: number;
}

export interface ChatContextPreparationResult {
	messages: ChatUIMessage[];
	collapsedMessagesByBudget: number;
	relevantPaths: string[];
	injectedRelevantFilesMessage: boolean;
}

export class ChatContextManager {
	private messageSizeCache = new WeakMap<ChatUIMessage, number>();

	prepareContext(
		messages: ChatUIMessage[],
		options: ChatContextPreparationOptions,
	): ChatContextPreparationResult {
		const collapsed = this.collapseByBudget(
			messages,
			options.maxContextChars,
			options.minMessagesAfterCollapse,
		);
		const relevantPaths = this.collectRelevantPaths(collapsed.messages);
		const injected = this.injectRelevantPathsMessage(
			collapsed.messages,
			relevantPaths,
		);

		return {
			messages: injected.messages,
			collapsedMessagesByBudget: collapsed.collapsedCount,
			relevantPaths,
			injectedRelevantFilesMessage: injected.injected,
		};
	}

	private collapseByBudget(
		messages: ChatUIMessage[],
		maxChars: number,
		minMessagesAfterCollapse: number,
	): { messages: ChatUIMessage[]; collapsedCount: number } {
		let working = [...messages];
		let collapsedCount = 0;
		while (
			working.length > minMessagesAfterCollapse &&
			this.estimateMessagesChars(working) > maxChars
		) {
			working = working.slice(1);
			collapsedCount += 1;
		}
		return { messages: working, collapsedCount };
	}

	private estimateMessagesChars(messages: ChatUIMessage[]): number {
		return messages.reduce(
			(sum, message) => sum + this.estimateMessageChars(message),
			0,
		);
	}

	private estimateMessageChars(message: ChatUIMessage): number {
		const cached = this.messageSizeCache.get(message);
		if (typeof cached === "number") return cached;

		let total = 0;
		for (const part of message.parts) {
			if (part.type === "text" || part.type === "reasoning") {
				total += part.text?.length ?? 0;
				continue;
			}
			if (part.type === "file") {
				total += 300;
				continue;
			}
			try {
				total += JSON.stringify(part).length;
			} catch {
				total += 80;
			}
		}
		this.messageSizeCache.set(message, total);
		return total;
	}

	private collectRelevantPaths(messages: ChatUIMessage[]): string[] {
		const paths: string[] = [];
		const seen = new Set<string>();

		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			let messageScore = i + 1;
			if (message.role === "assistant") {
				messageScore += 1000;
			}
			for (const part of message.parts) {
				if (part.type === "data-task-coding-v1") {
					for (const taskPart of part.data.parts) {
						collectPathsFromUnknown(taskPart, paths, seen, messageScore);
						if (paths.length >= MAX_RELEVANT_PATHS) break;
					}
				} else {
					collectPathsFromUnknown(part, paths, seen, messageScore);
				}
				if (paths.length >= MAX_RELEVANT_PATHS) break;
			}
			if (paths.length >= MAX_RELEVANT_PATHS) break;
		}

		return paths;
	}

	private injectRelevantPathsMessage(
		messages: ChatUIMessage[],
		relevantPaths: string[],
	): { messages: ChatUIMessage[]; injected: boolean } {
		if (relevantPaths.length === 0) {
			return { messages, injected: false };
		}

		const lastUserIndex = findLastUserMessageIndex(messages);
		if (lastUserIndex === -1) {
			return { messages, injected: false };
		}

		const text =
			"Relevant files recently touched:\n" +
			relevantPaths.map((path) => `- ${path}`).join("\n") +
			"\nUse these files first when iterating or fixing errors.";

		const contextMessage: ChatUIMessage = {
			id: `context-relevant-files-${Date.now()}`,
			role: "user",
			parts: [{ type: "text", text }],
		};

		const withContext = [...messages];
		withContext.splice(lastUserIndex, 0, contextMessage);
		return { messages: withContext, injected: true };
	}
}

function collectPathsFromUnknown(
	value: unknown,
	paths: string[],
	seen: Set<string>,
	score: number,
): void {
	if (paths.length >= MAX_RELEVANT_PATHS) return;

	if (typeof value === "string") {
		pushPath(value, paths, seen);
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectPathsFromUnknown(item, paths, seen, score);
			if (paths.length >= MAX_RELEVANT_PATHS) break;
		}
		return;
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		for (const key of ["path", "filePath", "filename"]) {
			const candidate = record[key];
			if (typeof candidate === "string") {
				pushPath(candidate, paths, seen);
			}
		}

		const listCandidate = record.paths;
		if (Array.isArray(listCandidate)) {
			for (const item of listCandidate) {
				if (typeof item === "string") {
					pushPath(item, paths, seen);
				}
			}
		}
	}
	void score;
}

function pushPath(path: string, paths: string[], seen: Set<string>): void {
	if (paths.length >= MAX_RELEVANT_PATHS) return;
	const cleaned = path.trim();
	if (
		!cleaned ||
		cleaned.startsWith("...and ") ||
		cleaned.startsWith("Error:") ||
		!cleaned.includes("/")
	) {
		return;
	}
	if (seen.has(cleaned)) return;
	seen.add(cleaned);
	paths.push(cleaned);
}

function findLastUserMessageIndex(messages: ChatUIMessage[]): number {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i].role === "user") {
			return i;
		}
	}
	return -1;
}
