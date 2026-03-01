import type { UIMessage, UIMessageStreamWriter } from "ai";
import { logger } from "@/lib/logging/logger";
import type { DataPart } from "../messages/data-parts";

type TaskLifecycleState = "pending" | "running" | "done" | "failed" | "aborted";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	toolCallId: string;
	taskNameActive: string;
	taskNameComplete: string;
}

export interface CodingTaskEmitter {
	loading(parts: Record<string, unknown>[]): void;
	done(parts: Record<string, unknown>[]): void;
	error(parts: Record<string, unknown>[]): void;
	aborted(parts: Record<string, unknown>[]): void;
}

export function createCodingTaskEmitter(params: Params): CodingTaskEmitter {
	let state: TaskLifecycleState = "pending";

	const canTransitionTo = (next: TaskLifecycleState): boolean => {
		if (state === "done" || state === "failed" || state === "aborted") {
			return false;
		}
		if (next === "running") {
			return state === "pending" || state === "running";
		}
		return true;
	};

	const emit = (
		next: TaskLifecycleState,
		status: "loading" | "done" | "error",
		parts: Record<string, unknown>[],
	) => {
		if (!canTransitionTo(next)) {
			logger.info({
				event: "tool.task.invalid_transition_ignored",
				tool_call_id: params.toolCallId,
				from_state: state,
				to_state: next,
			});
			return;
		}

		state = next;
		params.writer.write({
			id: params.toolCallId,
			type: "data-task-coding-v1",
			data: {
				taskNameActive: params.taskNameActive,
				taskNameComplete: params.taskNameComplete,
				status,
				parts,
			},
		});
	};

	return {
		loading(parts) {
			emit("running", "loading", parts);
		},
		done(parts) {
			emit("done", "done", parts);
		},
		error(parts) {
			emit("failed", "error", parts);
		},
		aborted(parts) {
			emit("aborted", "error", parts);
		},
	};
}
