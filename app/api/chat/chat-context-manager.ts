import type { ChatUIMessage } from "@/components/chat/types";

const MAX_RELEVANT_PATHS = 24;
const ROOT_PATH_ALLOWLIST = new Set([
	"package.json",
	"pnpm-lock.yaml",
	"bun.lock",
	"yarn.lock",
	"package-lock.json",
	"next.config.js",
	"next.config.mjs",
	"next.config.ts",
	"tsconfig.json",
	"tailwind.config.js",
	"tailwind.config.ts",
	"postcss.config.js",
	"postcss.config.mjs",
	"README.md",
]);

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
		const scores = new Map<string, number>();

		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			let messageScore = (i + 1) * 10;
			if (message.role === "assistant") {
				messageScore += 1000;
			}
			for (
				let partIndex = 0;
				partIndex < message.parts.length;
				partIndex += 1
			) {
				const part = message.parts[partIndex];
				const score = messageScore + (message.parts.length - partIndex);
				if (part.type === "data-task-coding-v1") {
					for (const taskPart of part.data.parts) {
						collectPathsFromUnknown(taskPart, scores, score);
					}
				} else {
					collectPathsFromUnknown(part, scores, score);
				}
			}
		}

		return [...scores.entries()]
			.sort((a, b) => {
				if (b[1] !== a[1]) return b[1] - a[1];
				if (a[0].length !== b[0].length) return a[0].length - b[0].length;
				return a[0].localeCompare(b[0]);
			})
			.slice(0, MAX_RELEVANT_PATHS)
			.map(([path]) => path);
	}

	private injectRelevantPathsMessage(
		messages: ChatUIMessage[],
		relevantPaths: string[],
	): { messages: ChatUIMessage[]; injected: boolean } {
		if (relevantPaths.length === 0) {
			return { messages, injected: false };
		}

		const text =
			"Relevant files recently touched:\n" +
			relevantPaths.map((path) => `- ${path}`).join("\n") +
			"\nUse these files first when iterating or fixing errors.";
		const latestContextText = findLatestRelevantPathsContextText(messages);
		if (latestContextText === text) {
			return { messages, injected: false };
		}

		const filtered = messages.filter(
			(message) => !message.id.startsWith("context-relevant-files-"),
		);
		const filteredLastUserIndex = findLastUserMessageIndex(filtered);
		if (filteredLastUserIndex === -1) {
			return { messages: filtered, injected: false };
		}

		const contextMessage: ChatUIMessage = {
			id: `context-relevant-files-${Date.now()}`,
			role: "user",
			parts: [{ type: "text", text }],
		};

		const withContext = [...filtered];
		withContext.splice(filteredLastUserIndex, 0, contextMessage);
		return { messages: withContext, injected: true };
	}
}

function collectPathsFromUnknown(
	value: unknown,
	scores: Map<string, number>,
	score: number,
): void {
	if (typeof value === "string") {
		pushPath(value, scores, score);
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectPathsFromUnknown(item, scores, score);
		}
		return;
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		for (const key of [
			"path",
			"filePath",
			"filename",
			"target",
			"from",
			"to",
		]) {
			const candidate = record[key];
			if (typeof candidate === "string") {
				pushPath(candidate, scores, score);
			}
		}

		const listCandidate = record.paths;
		if (Array.isArray(listCandidate)) {
			for (const item of listCandidate) {
				if (typeof item === "string") {
					pushPath(item, scores, score);
				}
			}
		}

		const filesCandidate = record.files;
		if (Array.isArray(filesCandidate)) {
			for (const item of filesCandidate) {
				collectPathsFromUnknown(item, scores, score);
			}
		}
	}
}

function pushPath(
	path: string,
	scores: Map<string, number>,
	score: number,
): void {
	const normalized = normalizePath(path);
	if (!normalized || !isLikelyProjectPath(normalized)) return;
	const previousScore = scores.get(normalized) ?? 0;
	if (score > previousScore) {
		scores.set(normalized, score);
	}
}

function normalizePath(path: string): string {
	let cleaned = path
		.trim()
		.replaceAll("`", "")
		.replaceAll('"', "")
		.replaceAll("'", "");

	cleaned = cleaned.replace(/^\/vercel\/sandbox\/?/, "");
	cleaned = cleaned.replace(/^\.\//, "");
	cleaned = cleaned.replace(/^\/+/, "");
	cleaned = cleaned.replace(/\/+$/, "");
	return cleaned;
}

function isLikelyProjectPath(cleaned: string): boolean {
	if (
		!cleaned ||
		cleaned.startsWith("...and ") ||
		cleaned.startsWith("Error:") ||
		cleaned.startsWith("http://") ||
		cleaned.startsWith("https://")
	) {
		return false;
	}
	if (cleaned.includes("..")) {
		return false;
	}
	if (cleaned.includes("/")) {
		return true;
	}
	if (ROOT_PATH_ALLOWLIST.has(cleaned)) {
		return true;
	}
	return /\.[a-z0-9]+$/i.test(cleaned);
}

function findLastUserMessageIndex(messages: ChatUIMessage[]): number {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i].role === "user") {
			return i;
		}
	}
	return -1;
}

function findLatestRelevantPathsContextText(
	messages: ChatUIMessage[],
): string | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (
			message.role !== "user" ||
			!message.id.startsWith("context-relevant-files-")
		) {
			continue;
		}
		const textPart = message.parts.find((part) => part.type === "text");
		return textPart?.text ?? null;
	}
	return null;
}
