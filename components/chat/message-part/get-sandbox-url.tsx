import type { DataPart } from "@/lib/ai/messages/data-parts";
import { LinkIcon } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";

export function GetSandboxURL({
	message,
}: {
	message: DataPart["get-sandbox-url"];
}) {
	// Determine overall status for trigger
	const getOverallStatus = () => {
		if (message.status === "done") return "done";
		return "loading";
	};

	return (
		<Task defaultOpen={true}>
			<TaskTrigger
				title="Get Sandbox URL"
				icon={<LinkIcon className="size-4" />}
				status={getOverallStatus()}
			/>
			<TaskContent>
				<TaskItem>
					{message.url ? (
						<a
							href={message.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							{message.url}
						</a>
					) : (
						<span>Getting Sandbox URL</span>
					)}
				</TaskItem>
			</TaskContent>
		</Task>
	);
}
