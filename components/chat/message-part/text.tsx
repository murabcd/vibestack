import type { TextUIPart } from "ai";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { cn } from "@/lib/utils";

export function Text({
	part,
	messageRole,
}: {
	part: TextUIPart;
	messageRole: "user" | "assistant";
}) {
	return (
		<div
			className={cn("text-sm", {
				"w-fit wrap-break-word rounded-2xl px-3 py-2 text-right bg-primary text-primary-foreground":
					messageRole === "user",
				"bg-transparent px-0 py-0 text-left": messageRole === "assistant",
			})}
		>
			<MarkdownRenderer content={part.text} />
		</div>
	);
}
