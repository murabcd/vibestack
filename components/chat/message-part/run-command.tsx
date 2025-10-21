import type { DataPart } from "@/lib/ai/messages/data-parts";
import { SquareChevronRightIcon } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";

export function RunCommand({ message }: { message: DataPart["run-command"] }) {
	// Determine title based on status
	const getTitle = () => {
		if (message.status === "executing") return "Executing";
		if (message.status === "waiting") return "Waiting";
		if (message.status === "running") return "Running in background";
		if (message.status === "done" && message.exitCode !== 1) return "Finished";
		if (message.status === "done" && message.exitCode === 1) return "Errored";
		if (message.status === "error") return "Errored";
		return "Command";
	};

	// Determine overall status for trigger
	const getOverallStatus = () => {
		if (message.status === "error") return "error";
		if (
			message.status === "done" &&
			message.exitCode !== undefined &&
			message.exitCode > 0
		)
			return "error";
		if (message.status === "done") return "done";
		return "loading";
	};

	const commandText = `${message.command} ${message.args.join(" ")}`;

	return (
		<Task defaultOpen={true}>
			<TaskTrigger
				title={getTitle()}
				icon={<SquareChevronRightIcon className="size-4" />}
				status={getOverallStatus()}
			/>
			<TaskContent>
				<TaskItem>{commandText}</TaskItem>
			</TaskContent>
		</Task>
	);
}
