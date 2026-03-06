import { useChat } from "@ai-sdk/react";
import type { TextUIPart } from "ai";
import { Check, Copy, PenLine, RotateCcw, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import { useSettings } from "@/components/settings/use-settings";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSharedChatContext } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

export const Text = memo(function Text({
	part,
	messageRole,
	messageId,
	onEditMessage,
	onDeleteMessage,
	showRegenerate = false,
}: {
	part: TextUIPart;
	messageRole: "user" | "assistant";
	messageId: string;
	onEditMessage?: (messageId: string, text: string) => void;
	onDeleteMessage?: (messageId: string) => void;
	showRegenerate?: boolean;
}) {
	const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
	const { chat } = useSharedChatContext();
	const { regenerate } = useChat({
		chat,
		experimental_throttle: 50,
	});
	const { modelId, reasoningEffort, webSearch } = useSettings();
	const visibleText =
		messageRole === "assistant" ? stripFencedCodeBlocks(part.text) : part.text;

	const handleCopyMessage = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
			setCopiedMessageId("temp");
			setTimeout(() => setCopiedMessageId(null), 2000);
		} catch (err) {
			console.error("Failed to copy message:", err);
		}
	};

	const handleRetryMessage = async () => {
		await regenerate({
			messageId,
			body: {
				modelId,
				reasoningEffort,
				webSearch,
			},
		});
	};

	return (
		<div className="group/text-part text-sm">
			<div
				className={cn({
					"w-fit wrap-break-word rounded-2xl px-3 py-2 bg-primary text-primary-foreground":
						messageRole === "user",
					"bg-transparent px-0 py-0 text-left": messageRole === "assistant",
				})}
			>
				<div
					className={cn("inline-block", {
						"text-left": messageRole === "user",
					})}
				>
					<MarkdownRenderer
						content={visibleText}
						isAnimating={
							messageRole === "assistant" && part.state === "streaming"
						}
					/>
				</div>
			</div>
			<div
				className={cn(
					"mt-1 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/text-part:opacity-100",
					{
						"justify-start": messageRole === "assistant",
						"justify-end": messageRole === "user",
					},
				)}
			>
				<TooltipProvider delayDuration={120}>
					{messageRole === "user" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => onEditMessage?.(messageId, part.text)}
									className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center cursor-pointer"
									aria-label="Edit message"
								>
									<PenLine className="size-3" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Edit message</TooltipContent>
						</Tooltip>
					)}
					{messageRole === "assistant" && showRegenerate && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => void handleRetryMessage()}
									className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center cursor-pointer"
									aria-label="Regenerate response"
								>
									<RotateCcw className="size-3" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Regenerate response</TooltipContent>
						</Tooltip>
					)}
					{messageRole !== "assistant" && (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => onDeleteMessage?.(messageId)}
									className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center cursor-pointer"
									aria-label="Delete message and response"
								>
									<Trash2 className="size-3" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Delete message</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => handleCopyMessage(part.text)}
								className="size-3.5 opacity-30 hover:opacity-70 flex items-center justify-center cursor-pointer"
								aria-label="Copy message"
							>
								{copiedMessageId ? (
									<Check className="size-3" />
								) : (
									<Copy className="size-3" />
								)}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							{copiedMessageId ? "Copied" : "Copy message"}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
}, areEqualTextProps);

function areEqualTextProps(
	prev: {
		part: TextUIPart;
		messageRole: "user" | "assistant";
		showRegenerate?: boolean;
	},
	next: {
		part: TextUIPart;
		messageRole: "user" | "assistant";
		showRegenerate?: boolean;
	},
): boolean {
	return (
		prev.messageRole === next.messageRole &&
		prev.showRegenerate === next.showRegenerate &&
		prev.part.text === next.part.text &&
		prev.part.state === next.part.state
	);
}

function stripFencedCodeBlocks(input: string): string {
	return input
		.replace(/```[\s\S]*?```/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
