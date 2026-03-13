import { describe, expect, it } from "vitest";
import { collapseConsecutiveReasoningParts } from "@/components/chat/message";
import type { ChatUIMessage } from "@/components/chat/types";

describe("collapseConsecutiveReasoningParts", () => {
	it("keeps only the newest reasoning part in a consecutive run", () => {
		const parts = [
			{ type: "reasoning", text: "first", state: "done" },
			{ type: "reasoning", text: "second", state: "done" },
			{ type: "data-task-coding-v1", data: { status: "done", parts: [] } },
			{ type: "reasoning", text: "third", state: "done" },
			{ type: "text", text: "final answer" },
		] satisfies ChatUIMessage["parts"];

		expect(collapseConsecutiveReasoningParts(parts)).toEqual([
			{ type: "reasoning", text: "second", state: "done" },
			{ type: "data-task-coding-v1", data: { status: "done", parts: [] } },
			{ type: "reasoning", text: "third", state: "done" },
			{ type: "text", text: "final answer" },
		]);
	});

	it("keeps separate reasoning entries across non-reasoning boundaries", () => {
		const parts = [
			{ type: "reasoning", text: "first", state: "done" },
			{ type: "data-task-coding-v1", data: { status: "done", parts: [] } },
			{ type: "reasoning", text: "second", state: "done" },
		] satisfies ChatUIMessage["parts"];

		expect(collapseConsecutiveReasoningParts(parts)).toEqual(parts);
	});

	it("returns the original array when there is no reasoning part", () => {
		const parts = [
			{ type: "text", text: "hello" },
		] satisfies ChatUIMessage["parts"];

		expect(collapseConsecutiveReasoningParts(parts)).toEqual(parts);
	});
});
