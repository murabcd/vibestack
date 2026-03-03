import { describe, expect, it } from "vitest";
import {
	getLastCompletePart,
	sliceMessagesThroughPart,
} from "../../components/chat/stream-persistence";
import type { ChatUIMessage } from "../../components/chat/types";

function message(
	id: string,
	role: "user" | "assistant",
	parts: ChatUIMessage["parts"],
): ChatUIMessage {
	return {
		id,
		role,
		parts,
	} as ChatUIMessage;
}

describe("stream persistence", () => {
	it("returns the previous complete part when stream ends mid-task", () => {
		const messages: ChatUIMessage[] = [
			message("u1", "user", [{ type: "text", text: "build" } as never]),
			message("a1", "assistant", [
				{
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Generating files",
						taskNameComplete: "Files generated",
						status: "loading",
						parts: [{ type: "generating-files-started" }],
					},
				} as never,
				{ type: "text", text: "partial" } as never,
			]),
		];

		const lastComplete = getLastCompletePart(messages, "streaming");
		expect(lastComplete).not.toBeNull();
		expect(lastComplete?.messageIndex).toBe(0);
		expect(lastComplete?.partIndex).toBe(0);
	});

	it("slices messages to the computed checkpoint", () => {
		const messages: ChatUIMessage[] = [
			message("u1", "user", [{ type: "text", text: "build" } as never]),
			message("a1", "assistant", [
				{ type: "text", text: "step 1" } as never,
				{
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Run",
						taskNameComplete: "Run",
						status: "loading",
						parts: [{ type: "run-command-started" }],
					},
				} as never,
				{ type: "text", text: "still streaming" } as never,
			]),
		];

		const checkpoint = getLastCompletePart(messages, "streaming");
		expect(checkpoint).not.toBeNull();
		if (!checkpoint) return;

		const persisted = sliceMessagesThroughPart(messages, checkpoint);
		expect(persisted).toHaveLength(2);
		expect(persisted[1].parts).toHaveLength(1);
	});
});
