import { useChat } from "@ai-sdk/react";
import type { TextUIPart } from "ai";
import { Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { useSettings } from "@/components/settings/use-settings";
import { useSharedChatContext } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

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
				"w-fit wrap-break-word rounded-2xl px-3 py-2 bg-primary text-primary-foreground":
					messageRole === "user",
				"bg-transparent px-0 py-0 text-left": messageRole === "assistant",
			})}
		>
			<div
				className={cn("relative group", {
					"text-right": messageRole === "user",
				})}
			>
				<div
					className={cn("inline-block", {
						"text-left": messageRole === "user",
					})}
				>
					<MarkdownRenderer content={part.text} />
				</div>
				<div className="absolute top-0 right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
