import type { ReasoningUIPart } from "ai";
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

	if (part.state === "done" && !part.text) {
		return null;
	}

	const text = part.text || "_Thinking_";
	const isStreaming = part.state === "streaming";
	const firstLine = text.split("\n")[0].replace(/\*\*/g, "");
	const hasMoreContent = text.includes("\n") || text.length > 80;

	const handleClick = () => {
		if (hasMoreContent && context) {
			const newIndex = isExpanded ? null : partIndex;
			context.setExpandedReasoningIndex(newIndex);
		}
	};

	return (
		<button
			type="button"
			className="text-sm border border-border bg-background rounded-md cursor-pointer hover:bg-accent/30 transition-colors w-full text-left"
			onClick={handleClick}
		>
			<div className="px-3 py-2">
				<div className="text-secondary-foreground leading-normal text-sm">
					{isExpanded || !hasMoreContent ? (
						<MarkdownRenderer content={text} />
					) : (
						<div className="overflow-hidden">{firstLine}</div>
					)}
					{isStreaming && isExpanded && <MessageSpinner />}
				</div>
			</div>
		</button>
	);
}
