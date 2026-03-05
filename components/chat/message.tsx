import type { ReactNode } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MessagePart } from "./message-part";
import { ImageDisplay } from "./message-part/image-display";
import type { ChatStreamStatus } from "./stream-persistence";
import type { ChatUIMessage } from "./types";

interface Props {
	message: ChatUIMessage;
	streamStatus: ChatStreamStatus;
	onEditMessage?: (messageId: string, text: string) => void;
	onDeleteMessage?: (messageId: string) => void;
	addToolApprovalResponse?: (payload: {
		id: string;
		approved: boolean;
		reason?: string;
	}) => void | PromiseLike<void>;
}

interface ReasoningContextType {
	expandedReasoningIndex: number | null;
	setExpandedReasoningIndex: (index: number | null) => void;
}

const ReasoningContext = createContext<ReasoningContextType | null>(null);

export const useReasoningContext = () => {
	const context = useContext(ReasoningContext);
	return context;
};

export const Message = memo(function Message({
	message,
	streamStatus,
	onEditMessage,
	onDeleteMessage,
	addToolApprovalResponse,
}: Props) {
	const [expandedReasoningIndex, setExpandedReasoningIndex] = useState<
		number | null
	>(null);
	const renderedParts = coalesceStreamingTaskParts(message.parts);
	const visibleParts =
		message.role === "assistant"
			? renderedParts.filter(isAssistantTaskPart)
			: renderedParts;
	const hasTextPart = visibleParts.some(
		(part) => part.type === "text" && part.text?.trim(),
	);
	const hasToolOrTaskPart = visibleParts.some(
		(part) =>
			part.type === "dynamic-tool" ||
			part.type.startsWith("tool-") ||
			part.type === "reasoning" ||
			part.type.startsWith("data-"),
	);

	const reasoningParts = visibleParts
		.map((part, index) => ({ part, index }))
		.filter(({ part }) => part.type === "reasoning");

	useEffect(() => {
		if (reasoningParts.length > 0) {
			const latestReasoningWithText = [...reasoningParts]
				.reverse()
				.find(
					({ part }) =>
						part.type === "reasoning" && Boolean(part.text?.trim().length),
				);
			const nextExpandedIndex =
				latestReasoningWithText?.index ??
				reasoningParts[reasoningParts.length - 1].index;
			setExpandedReasoningIndex(nextExpandedIndex);
		}
	}, [reasoningParts]);

	return (
		<ReasoningContext.Provider
			value={{ expandedReasoningIndex, setExpandedReasoningIndex }}
		>
			<div className="group/message w-full min-w-0" data-role={message.role}>
				<div
					className={cn("flex w-full min-w-0 items-start", {
						"justify-end": message.role === "user",
						"justify-start": message.role === "assistant",
					})}
				>
					<div
						className={cn("flex flex-col min-w-0", {
							"gap-2 md:gap-4": hasTextPart && !hasToolOrTaskPart,
							"gap-1.5": hasToolOrTaskPart,
							"w-full": message.role === "assistant",
							"max-w-[min(fit-content,80%)]": message.role === "user",
						})}
					>
						{renderVisibleParts({
							message,
							streamStatus,
							visibleParts,
							onDeleteMessage,
							onEditMessage,
							addToolApprovalResponse,
						})}
					</div>
				</div>
			</div>
		</ReasoningContext.Provider>
	);
});

function isAssistantTaskPart(part: ChatUIMessage["parts"][number]): boolean {
	return (
		part.type === "text" ||
		part.type === "data-task-coding-v1" ||
		part.type === "data-report-errors" ||
		part.type === "reasoning" ||
		part.type === "tool-runCommand"
	);
}

function coalesceStreamingTaskParts(
	parts: ChatUIMessage["parts"],
): ChatUIMessage["parts"] {
	const merged: ChatUIMessage["parts"] = [];
	const indexByTaskKey = new Map<string, number>();

	for (const part of parts) {
		if (!part.type.startsWith("data-")) {
			merged.push(part);
			continue;
		}

		const partWithId = part as Record<string, unknown>;
		const id = typeof partWithId.id === "string" ? partWithId.id : null;
		if (!id) {
			merged.push(part);
			continue;
		}

		const taskKey = `${part.type}:${id}`;
		const existingIndex = indexByTaskKey.get(taskKey);
		if (existingIndex === undefined) {
			indexByTaskKey.set(taskKey, merged.length);
			merged.push(part);
			continue;
		}

		merged[existingIndex] = part;
	}

	return collapseRepeatedTerminalTasks(merged);
}

function collapseRepeatedTerminalTasks(
	parts: ChatUIMessage["parts"],
): ChatUIMessage["parts"] {
	const compacted: ChatUIMessage["parts"] = [];

	for (const part of parts) {
		if (!part.type.startsWith("data-")) {
			compacted.push(part);
			continue;
		}

		const currentStatus = getTaskStatus(part);
		const prev = compacted[compacted.length - 1];
		const prevStatus = prev?.type.startsWith("data-")
			? getTaskStatus(prev)
			: null;
		const currentId = (part as { id?: unknown }).id;
		const prevId = prev ? (prev as { id?: unknown }).id : undefined;
		const currentSignature = getDataPartSignature(part);
		const prevSignature = prev?.type.startsWith("data-")
			? getDataPartSignature(prev)
			: null;
		const isRepeatedTerminalState =
			prev?.type === part.type &&
			currentStatus !== null &&
			currentStatus === prevStatus &&
			(currentStatus === "done" || currentStatus === "error") &&
			((typeof currentId === "string" &&
				typeof prevId === "string" &&
				currentId === prevId) ||
				(currentSignature !== null &&
					prevSignature !== null &&
					currentSignature === prevSignature));

		if (isRepeatedTerminalState) {
			compacted[compacted.length - 1] = part;
			continue;
		}

		compacted.push(part);
	}

	return compacted;
}

function getTaskStatus(part: ChatUIMessage["parts"][number]): string | null {
	const withData = part as { data?: unknown };
	if (!withData || typeof withData !== "object") {
		return null;
	}
	const data = withData.data as { status?: unknown } | undefined;
	return typeof data?.status === "string" ? data.status : null;
}

function getDataPartSignature(
	part: ChatUIMessage["parts"][number],
): string | null {
	if (!part.type.startsWith("data-")) return null;

	if (part.type === "data-task-coding-v1") {
		return `${part.type}:${part.data.status}:${part.data.taskNameActive ?? ""}:${part.data.taskNameComplete ?? ""}:${JSON.stringify(part.data.parts)}`;
	}

	if (part.type === "data-report-errors") {
		return `${part.type}:${part.data.summary}`;
	}

	return null;
}

function renderVisibleParts({
	message,
	streamStatus,
	visibleParts,
	onEditMessage,
	onDeleteMessage,
	addToolApprovalResponse,
}: {
	message: ChatUIMessage;
	streamStatus: ChatStreamStatus;
	visibleParts: ChatUIMessage["parts"];
	onEditMessage?: (messageId: string, text: string) => void;
	onDeleteMessage?: (messageId: string) => void;
	addToolApprovalResponse?: (payload: {
		id: string;
		approved: boolean;
		reason?: string;
	}) => void | PromiseLike<void>;
}) {
	const nodes: ReactNode[] = [];

	for (let index = 0; index < visibleParts.length; index += 1) {
		const part = visibleParts[index];
		if (part.type === "file") {
			const startIndex = index;
			const fileParts: Extract<
				ChatUIMessage["parts"][number],
				{ type: "file" }
			>[] = [];

			while (
				index < visibleParts.length &&
				visibleParts[index].type === "file"
			) {
				fileParts.push(
					visibleParts[index] as Extract<
						ChatUIMessage["parts"][number],
						{ type: "file" }
					>,
				);
				index += 1;
			}

			index -= 1;
			nodes.push(
				<ImageDisplay
					key={`${message.role}-file-group-${startIndex}`}
					messageRole={message.role as "user" | "assistant"}
					parts={fileParts}
				/>,
			);
			continue;
		}

		nodes.push(
			<MessagePart
				key={`${message.role}-${part.type}-${index}`}
				messageId={message.id}
				messageRole={message.role as "user" | "assistant"}
				streamStatus={streamStatus}
				isLastPart={index === visibleParts.length - 1}
				onDeleteMessage={onDeleteMessage}
				onEditMessage={onEditMessage}
				addToolApprovalResponse={addToolApprovalResponse}
				part={part}
				partIndex={index}
			/>,
		);
	}

	return nodes;
}
