import type { ReasoningUIPart } from "ai";
import { BrainIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Task, TaskContent, TaskTrigger } from "@/components/ai-elements/task";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { useReasoningContext } from "../message";
import { MessageSpinner } from "../message-spinner";

export function Reasoning({
	part,
	partIndex,
}: {
	part: ReasoningUIPart;
	partIndex: number;
}) {
	const context = useReasoningContext();
	const isExpanded = context?.expandedReasoningIndex === partIndex;
	const startedAtRef = useRef<number>(Date.now());
	const [elapsedSeconds, setElapsedSeconds] = useState(1);
	const durationSeconds = useMemo(() => {
		if (part.state !== "done") return null;
		return Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
	}, [part.state]);

	useEffect(() => {
		if (part.state !== "streaming") return;

		const timer = window.setInterval(() => {
			setElapsedSeconds(
				Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
			);
		}, 1000);

		return () => window.clearInterval(timer);
	}, [part.state]);

	if (part.state === "done" && !part.text) {
		return null;
	}

	const text = part.text || "";
	const isStreaming = part.state === "streaming";
	const thoughtTitle = isStreaming
		? `Thought for ${elapsedSeconds}s`
		: `Thought for ${durationSeconds ?? 1}s`;

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
