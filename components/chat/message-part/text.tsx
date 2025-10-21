import type { TextUIPart } from "ai";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";

export function Text({ part }: { part: TextUIPart }) {
	return (
		<div className="text-sm px-3.5 py-3 border bg-secondary/90 text-secondary-foreground border-border rounded-md">
			<MarkdownRenderer content={part.text} />
		</div>
	);
}
