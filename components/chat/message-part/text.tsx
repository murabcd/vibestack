import type { TextUIPart } from "ai";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { cn } from "@/lib/utils";
import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useSharedChatContext } from "@/lib/chat-context";
import { useChat } from "@ai-sdk/react";
import { useSettings } from "@/components/settings/use-settings";

export function Text({
	part,
	messageRole,
}: {
	part: TextUIPart;
	messageRole: "user" | "assistant";
}) {
	const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
	const { chat } = useSharedChatContext();
	const { sendMessage } = useChat({ chat });
	const { modelId, reasoningEffort } = useSettings();

	const handleCopyMessage = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
			setCopiedMessageId("temp");
			setTimeout(() => setCopiedMessageId(null), 2000);
		} catch (err) {
			console.error("Failed to copy message:", err);
		}
	};

	const handleRetryMessage = async (content: string) => {
		sendMessage(
			{
				text: content,
			},
			{
				body: {
					modelId,
					reasoningEffort,
				},
			},
		);
	};

	return (
		<div
			className={cn("text-xs", {
				"w-fit wrap-break-word rounded-2xl px-3 py-2 text-right bg-primary text-primary-foreground":
					messageRole === "user",
				"bg-transparent px-0 py-0 text-left": messageRole === "assistant",
			})}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<MarkdownRenderer content={part.text} />
				</div>
				<div className="flex items-center gap-0.5">
					{messageRole === "user" && (
						<button
							type="button"
							onClick={() => handleRetryMessage(part.text)}
							className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center"
						>
							<RotateCcw className="size-3" />
						</button>
					)}
					<button
						type="button"
						onClick={() => handleCopyMessage(part.text)}
						className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center"
					>
						{copiedMessageId ? (
							<Check className="size-3" />
						) : (
							<Copy className="size-3" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
