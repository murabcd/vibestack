import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { pruneMessagesForChat } from "../../app/api/chat/pruning";

describe("chat pruning", () => {
	it("preserves reasoning parts for follow-up turns", () => {
		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [{ type: "text", text: "hello" }],
			},
			{
				role: "assistant",
				content: [
					{
						type: "reasoning",
						text: "thinking",
						providerOptions: {
							openai: {
								itemId: "rs_123",
								reasoningEncryptedContent: "enc_123",
							},
						},
					},
					{
						type: "text",
						text: "hi there",
						providerOptions: {
							openai: {
								itemId: "msg_123",
							},
						},
					},
				],
			},
			{
				role: "user",
				content: [{ type: "text", text: "what day is it?" }],
			},
		];

		const pruned = pruneMessagesForChat(messages);
		const assistant = pruned[1];

		expect(assistant?.role).toBe("assistant");
		expect(Array.isArray(assistant?.content)).toBe(true);
		expect(
			Array.isArray(assistant?.content) &&
				assistant.content.some((part) => part.type === "reasoning"),
		).toBe(true);
	});
});
