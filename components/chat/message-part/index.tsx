import type { UIMessage } from "ai";
import { memo } from "react";
import type { DataPart } from "@/lib/ai/messages/data-parts";
import type { Metadata } from "@/lib/ai/messages/metadata";
import type { ToolSet } from "@/lib/ai/tools";
import type { ChatStreamStatus } from "../stream-persistence";
import { ImageDisplay } from "./image-display";
import { Reasoning } from "./reasoning";
import { TaskPart } from "./task-part";
import { Text } from "./text";
import { ToolApproval } from "./tool-approval";

interface Props {
	part: UIMessage<Metadata, DataPart, ToolSet>["parts"][number];
	partIndex: number;
	streamStatus: ChatStreamStatus;
	isLastPart: boolean;
	messageRole: "user" | "assistant";
	messageId: string;
	onEditMessage?: (messageId: string, text: string) => void;
	onDeleteMessage?: (messageId: string) => void;
	addToolApprovalResponse?: (payload: {
		id: string;
		approved: boolean;
		reason?: string;
	}) => void | PromiseLike<void>;
}

export const MessagePart = memo(function MessagePart({
	part,
	partIndex,
	streamStatus,
	isLastPart,
	messageRole,
	messageId,
	onEditMessage,
	onDeleteMessage,
	addToolApprovalResponse,
}: Props) {
	if (part.type === "step-start") {
		return null;
	}

	if (
		part.type === "data-task-coding-v1" ||
		part.type === "data-report-errors"
	) {
		return (
			<TaskPart
				part={
					part as Extract<
						Props["part"],
						{
							type: "data-task-coding-v1" | "data-report-errors";
						}
					>
				}
			/>
		);
	} else if (part.type === "reasoning") {
		return (
			<Reasoning
				part={part}
				partIndex={partIndex}
				streamStatus={streamStatus}
				isLastPart={isLastPart}
			/>
		);
	} else if (part.type === "text") {
		return (
			<Text
				part={part}
				messageRole={messageRole}
				messageId={messageId}
				onEditMessage={onEditMessage}
				onDeleteMessage={onDeleteMessage}
			/>
		);
	} else if (part.type === "file") {
		return <ImageDisplay messageRole={messageRole} parts={[part]} />;
	} else if (part.type === "tool-runCommand") {
		return (
			<ToolApproval
				part={part}
				addToolApprovalResponse={addToolApprovalResponse}
			/>
		);
	}
	return null;
});
