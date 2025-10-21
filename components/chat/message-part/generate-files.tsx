import type { DataPart } from "@/lib/ai/messages/data-parts";
import { CheckIcon, CloudUploadIcon, XIcon } from "lucide-react";
import { Spinner } from "./spinner";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";

export function GenerateFiles(props: {
	className?: string;
	message: DataPart["generating-files"];
}) {
	const lastInProgress = ["error", "uploading", "generating"].includes(
		props.message.status,
	);

	const generated = lastInProgress
		? props.message.paths.slice(0, props.message.paths.length - 1)
		: props.message.paths;

	const generating = lastInProgress
		? (props.message.paths[props.message.paths.length - 1] ?? "")
		: null;

	// Determine overall status for trigger
	const getOverallStatus = () => {
		if (props.message.status === "error") return "error";
		if (props.message.status === "done") return "done";
		return "loading";
	};

	const title =
		props.message.status === "done" ? "Uploaded files" : "Generating files";

	return (
		<Task className={props.className} defaultOpen={true}>
			<TaskTrigger
				title={title}
				icon={<CloudUploadIcon className="size-4" />}
				status={getOverallStatus()}
			/>
			<TaskContent>
				{generated.map((path) => (
					<TaskItem key={"gen" + path} className="flex items-center gap-2">
						<CheckIcon className="size-3" />
						<span className="whitespace-pre-wrap">{path}</span>
					</TaskItem>
				))}
				{typeof generating === "string" && (
					<TaskItem className="flex items-center gap-2">
						<Spinner
							loading={props.message.status !== "error"}
							className="size-3"
						>
							{props.message.status === "error" ? (
								<XIcon className="size-3 text-destructive" />
							) : (
								<CheckIcon className="size-3" />
							)}
						</Spinner>
						<span>{generating}</span>
					</TaskItem>
				)}
			</TaskContent>
		</Task>
	);
}
