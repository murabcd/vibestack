import { describe, expect, it } from "vitest";

import { createCodingTaskEmitter } from "../../lib/ai/tools/task-state-machine";

describe("task state machine", () => {
	it("prevents transitions after terminal state", () => {
		const writes: unknown[] = [];
		const emitter = createCodingTaskEmitter({
			writer: { write: (value: unknown) => void writes.push(value) } as never,
			toolCallId: "tool-1",
			taskNameActive: "Task",
			taskNameComplete: "Task",
		});

		emitter.loading([{ type: "started" }]);
		emitter.done([{ type: "done" }]);
		emitter.loading([{ type: "late" }]);
		emitter.error([{ type: "late-error" }]);

		expect(writes).toHaveLength(2);
	});
});
