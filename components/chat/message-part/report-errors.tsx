import type { DataPart } from "@/lib/ai/messages/data-parts";
import { BugIcon } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";
import Markdown from "react-markdown";

export function ReportErrors({
	message,
}: {
	message: DataPart["report-errors"];
}) {
	return (
		<Task defaultOpen={true}>
			<TaskTrigger
				title="Auto-detected errors"
				icon={<BugIcon className="size-4" />}
				status="error"
			/>
			<TaskContent>
				<TaskItem>
					<Markdown>{message.summary}</Markdown>
				</TaskItem>
			</TaskContent>
		</Task>
	);
}
