import { describe, expect, it } from "vitest";
import { ChatContextManager } from "../../app/api/chat/chat-context-manager";
import type { ChatUIMessage } from "../../components/chat/types";

function msg(
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

describe("ChatContextManager", () => {
	it("injects relevant paths context message", () => {
		const manager = new ChatContextManager();
		const messages: ChatUIMessage[] = [
			msg("u1", "user", "build"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-task-coding-v1",
						data: {
							taskNameActive: "Generating files",
							taskNameComplete: "Files generated",
							status: "done",
							parts: [
								{ type: "generated-files-complete", paths: ["app/page.tsx"] },
							],
						},
					},
				],
			} as unknown as ChatUIMessage,
			msg("u2", "user", "fix"),
		];

		const prepared = manager.prepareContext(messages, {
			maxContextChars: 5000,
			minMessagesAfterCollapse: 1,
		});

		expect(prepared.relevantPaths).toContain("app/page.tsx");
		expect(prepared.injectedRelevantFilesMessage).toBe(true);
		expect(
			prepared.messages.some((m) => m.id.startsWith("context-relevant-files-")),
		).toBe(true);
	});

	it("does not re-inject identical relevant-files helper message", () => {
		const manager = new ChatContextManager();
		const helperText =
			"Relevant files recently touched:\n- app/page.tsx\nUse these files first when iterating or fixing errors.";
		const messages: ChatUIMessage[] = [
			msg("u1", "user", "build"),
			{
				id: "context-relevant-files-existing",
				role: "user",
				parts: [{ type: "text", text: helperText }],
			} as unknown as ChatUIMessage,
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-task-coding-v1",
						data: {
							taskNameActive: "Generating files",
							taskNameComplete: "Files generated",
							status: "done",
							parts: [
								{ type: "generated-files-complete", paths: ["app/page.tsx"] },
							],
						},
					},
				],
			} as unknown as ChatUIMessage,
		];

		const prepared = manager.prepareContext(messages, {
			maxContextChars: 5000,
			minMessagesAfterCollapse: 1,
		});

		expect(prepared.injectedRelevantFilesMessage).toBe(false);
		expect(
			prepared.messages.filter((m) =>
				m.id.startsWith("context-relevant-files-"),
			).length,
		).toBe(1);
	});

	it("collapses old messages when over budget", () => {
		const manager = new ChatContextManager();
		const messages: ChatUIMessage[] = Array.from({ length: 20 }).map(
			(_, index) =>
				msg(
					`m${index}`,
					index % 2 === 0 ? "assistant" : "user",
					"x".repeat(400),
				),
		);

		const prepared = manager.prepareContext(messages, {
			maxContextChars: 3000,
			minMessagesAfterCollapse: 6,
		});

		expect(prepared.collapsedMessagesByBudget).toBeGreaterThan(0);
		expect(prepared.messages.length).toBeLessThan(messages.length);
	});

	it("keeps root-level config files in relevant paths", () => {
		const manager = new ChatContextManager();
		const messages: ChatUIMessage[] = [
			msg("u1", "user", "set up scripts"),
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-task-coding-v1",
						data: {
							taskNameActive: "Generating files",
							taskNameComplete: "Files generated",
							status: "done",
							parts: [
								{
									type: "generated-files-complete",
									paths: ["package.json", "tsconfig.json"],
								},
							],
						},
					},
				],
			} as unknown as ChatUIMessage,
		];

		const prepared = manager.prepareContext(messages, {
			maxContextChars: 5000,
			minMessagesAfterCollapse: 1,
		});

		expect(prepared.relevantPaths).toContain("package.json");
		expect(prepared.relevantPaths).toContain("tsconfig.json");
	});
});
