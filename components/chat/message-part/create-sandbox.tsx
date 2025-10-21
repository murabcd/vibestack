import type { DataPart } from "@/lib/ai/messages/data-parts";
import { BoxIcon } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";

interface Props {
	message: DataPart["create-sandbox"];
}

export function CreateSandbox({ message }: Props) {
	// Determine status message
	const getStatusMessage = () => {
		if (message.status === "done") return "Sandbox created successfully";
		if (message.status === "loading") return "Creating Sandbox";
		if (message.status === "error") return "Failed to create sandbox";
		return "Create Sandbox";
	};

	// Determine overall status for trigger
	const getOverallStatus = () => {
		if (message.status === "error") return "error";
		if (message.status === "done") return "done";
		return "loading";
	};

	return (
		<Task defaultOpen={true}>
			<TaskTrigger
				title="Create Sandbox"
				icon={<BoxIcon className="size-4" />}
				status={getOverallStatus()}
			/>
			<TaskContent>
				<TaskItem>{getStatusMessage()}</TaskItem>
			</TaskContent>
		</Task>
	);
}
