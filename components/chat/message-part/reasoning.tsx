import type { ReasoningUIPart } from "ai";
import { BrainIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Task, TaskContent, TaskTrigger } from "@/components/ai-elements/task";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { useReasoningContext } from "../message";
import { MessageSpinner } from "../message-spinner";
import type { ChatStreamStatus } from "../stream-persistence";

export function Reasoning({
	part,
	partIndex,
	streamStatus,
	isLastPart,
}: {
	part: ReasoningUIPart;
	partIndex: number;
	streamStatus: ChatStreamStatus;
	isLastPart: boolean;
}) {
	const context = useReasoningContext();
	const isExpanded = context?.expandedReasoningIndex === partIndex;
	const startedAtRef = useRef<number>(Date.now());
	const [elapsedSeconds, setElapsedSeconds] = useState(1);
	const isMessageStreaming =
		streamStatus === "submitted" || streamStatus === "streaming";
	const keepPlaceholderWhileStreaming =
		!part.text && isMessageStreaming && isLastPart;
	const isStreaming =
		part.state === "streaming" || keepPlaceholderWhileStreaming;
	const durationSeconds = useMemo(() => {
		if (part.state !== "done") return null;
		return Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
	}, [part.state]);

	useEffect(() => {
		if (!isStreaming) return;

		const timer = window.setInterval(() => {
			setElapsedSeconds(
				Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
			);
		}, 1000);

		return () => window.clearInterval(timer);
	}, [isStreaming]);

	if (part.state === "done" && !part.text && !keepPlaceholderWhileStreaming) {
		return null;
	}

	const text = part.text || "";
	const hasReasoningText = text.trim().length > 0;
	const thoughtTitle = isStreaming
		? `Thought for ${elapsedSeconds}s`
		: `Thought for ${durationSeconds ?? 1}s`;

	if (!hasReasoningText) {
		return (
			<Task defaultOpen={false} open={false}>
				<TaskTrigger
					title={thoughtTitle}
					icon={<BrainIcon className="size-4" />}
					status={isStreaming ? "loading" : "done"}
					hideChevron
				/>
			</Task>
		);
	}

	return (
		<Task
			defaultOpen={isExpanded}
			open={isExpanded}
			onOpenChange={(open) => {
				if (!context) return;
				context.setExpandedReasoningIndex(open ? partIndex : null);
			}}
		>
			<TaskTrigger
				title={thoughtTitle}
				icon={<BrainIcon className="size-4" />}
				status={isStreaming ? "loading" : "done"}
			/>
			<TaskContent lazy={false}>
				<div className="text-secondary-foreground leading-normal text-sm px-3 pb-3">
					<MarkdownRenderer content={text} isAnimating={isStreaming} />
					{isStreaming && <MessageSpinner />}
				</div>
			</TaskContent>
		</Task>
	);
}
