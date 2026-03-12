import { type ModelMessage, pruneMessages } from "ai";

export function pruneMessagesForChat(messages: ModelMessage[]): ModelMessage[] {
	return pruneMessages({
		messages,
		reasoning: "none",
		toolCalls: "before-last-2-messages",
		emptyMessages: "remove",
	});
}
