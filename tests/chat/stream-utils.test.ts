import { describe, expect, it } from "vitest";
import {
	compactMessagesForModel,
	injectRelevantFileContentMessage,
	prepareMessagesForAgent,
	reconcileIncompleteTaskMessages,
	sanitizeMessagesForModel,
} from "../../app/api/chat/stream-utils";
import type { ChatUIMessage } from "../../components/chat/types";

function textMessage(
	id: string,
	role: "user" | "assistant",
	text: string,
): ChatUIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	} as unknown as ChatUIMessage;
}

describe("chat stream utils", () => {
	it("sanitizes assistant thought artifacts and blocks protected file mutations", () => {
		const messages: ChatUIMessage[] = [
			textMessage("u1", "user", "build app"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: '<think>hidden</think><boltAction type="file" filePath=".env">x</boltAction><div class=\\"__boltThought__\\">internal</div>done',
					},
				],
			},
		] as unknown as ChatUIMessage[];

		const { messages: sanitized, stats } = sanitizeMessagesForModel(messages);
		const assistantText =
			sanitized[1].parts[0]?.type === "text" ? sanitized[1].parts[0].text : "";

		expect(assistantText).not.toContain("<think>");
		expect(assistantText).not.toContain("__boltThought__");
		expect(assistantText).toContain(
			"Attempted modification of protected file `.env` was blocked.",
		);
		expect(stats.sanitizedAssistantParts).toBe(1);
		expect(stats.blockedProtectedMutations).toBe(1);
	});

	it("prepares messages with relevant file paths extracted from task parts", () => {
		const messages: ChatUIMessage[] = [
			textMessage("u1", "user", "make updates"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-task-coding-v1",
						data: {
							taskNameActive: "Generating files",
							taskNameComplete: "Files generated",
							status: "complete",
							parts: [
								{
									type: "files-generated",
									paths: ["app/page.tsx", "lib/utils.ts"],
								},
							],
						},
					},
				],
			},
			textMessage("u2", "user", "fix bug now"),
		] as unknown as ChatUIMessage[];

		const result = prepareMessagesForAgent(messages);
		const injected = result.messages.find((m) =>
			m.id.startsWith("context-relevant-files-"),
		);
		const injectedText =
			injected?.parts?.[0]?.type === "text" ? injected.parts[0].text : "";

		expect(result.stats.injectedRelevantFilesMessage).toBe(true);
		expect(result.relevantPaths).toContain("app/page.tsx");
		expect(result.relevantPaths).toContain("lib/utils.ts");
		expect(injectedText).toContain("Relevant files recently touched:");
		expect(injectedText).toContain("- app/page.tsx");
	});

	it("injects relevant file contents and removes stale context helper messages", () => {
		const messages: ChatUIMessage[] = [
			textMessage("context-relevant-files-123", "user", "old helper message"),
			textMessage("u1", "user", "build app"),
			textMessage("a1", "assistant", "ok"),
		];

		const { messages: withContext, injected } =
			injectRelevantFileContentMessage(messages, [
				{ path: "app/page.tsx", content: "export default function Page() {}" },
			]);

		expect(injected).toBe(true);
		expect(withContext.some((m) => m.id === "context-relevant-files-123")).toBe(
			false,
		);
		const helper = withContext.find((m) =>
			m.id.startsWith("context-relevant-file-contents-"),
		);
		expect(helper).toBeDefined();
		const helperText =
			helper?.parts[0]?.type === "text" ? helper.parts[0].text : "";
		expect(helperText).toContain("Path: app/page.tsx");
	});

	it("compacts old reasoning parts while keeping recent content", () => {
		const messages: ChatUIMessage[] = Array.from({ length: 10 }).map(
			(_, index) =>
				({
					id: `m${index}`,
					role: index % 2 === 0 ? "assistant" : "user",
					parts:
						index === 0
							? [
									{ type: "reasoning", text: "internal" },
									{ type: "text", text: "visible" },
								]
							: [{ type: "text", text: `msg ${index}` }],
				}) as unknown as ChatUIMessage,
		);

		const { messages: compacted, stats } = compactMessagesForModel(messages);
		const firstParts = compacted[0].parts;

		expect(firstParts.some((part) => part.type === "reasoning")).toBe(false);
		expect(firstParts.some((part) => part.type === "text")).toBe(true);
		expect(stats.droppedReasoningParts).toBe(1);
	});

	it("reconciles incomplete task parts from interrupted streams", () => {
		const messages: ChatUIMessage[] = [
			textMessage("u1", "user", "build app"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-task-thinking-v1",
						data: {
							taskNameActive: "Thought for 3s",
							taskNameComplete: "Thought for 3s",
							status: "loading",
							parts: [{ type: "thinking-step", stepNumber: 1 }],
						},
					},
					{
						type: "data-task-coding-v1",
						data: {
							taskNameActive: "Generating files",
							taskNameComplete: "Files generated",
							status: "loading",
							parts: [{ type: "generating-files-started" }],
						},
					},
				],
			} as unknown as ChatUIMessage,
		];

		const reconciled = reconcileIncompleteTaskMessages(messages);
		expect(reconciled.stats.reconciledThinkingTasks).toBe(1);
		expect(reconciled.stats.reconciledCodingTasks).toBe(1);

		const assistant = reconciled.messages[1];
		const thinkingPart = assistant.parts.find(
			(part) => part.type === "data-task-thinking-v1",
		);
		const codingPart = assistant.parts.find(
			(part) => part.type === "data-task-coding-v1",
		);
		expect(thinkingPart?.type).toBe("data-task-thinking-v1");
		expect(
			thinkingPart?.type === "data-task-thinking-v1"
				? thinkingPart.data.status
				: "",
		).toBe("done");
		expect(codingPart?.type).toBe("data-task-coding-v1");
		expect(
			codingPart?.type === "data-task-coding-v1" ? codingPart.data.status : "",
		).toBe("error");
	});
});
