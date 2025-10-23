import type { ChatUIMessage } from "./types";
import { MessagePart } from "./message-part";
import { SparklesIcon } from "lucide-react";
import { memo, createContext, useContext, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
	message: ChatUIMessage;
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

export const Message = memo(function Message({ message }: Props) {
	const [expandedReasoningIndex, setExpandedReasoningIndex] = useState<
		number | null
	>(null);

	const reasoningParts = message.parts
		.map((part, index) => ({ part, index }))
		.filter(({ part }) => part.type === "reasoning");

	useEffect(() => {
		if (reasoningParts.length > 0) {
			const latestReasoningIndex =
				reasoningParts[reasoningParts.length - 1].index;
			setExpandedReasoningIndex(latestReasoningIndex);
		}
	}, [reasoningParts]);

	return (
		<ReasoningContext.Provider
			value={{ expandedReasoningIndex, setExpandedReasoningIndex }}
		>
			<div className="group/message w-full" data-role={message.role}>
				<div
					className={cn("flex w-full items-start gap-2 md:gap-3", {
						"justify-end": message.role === "user",
						"justify-start": message.role === "assistant",
					})}
				>
					{message.role === "assistant" && (
						<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
							<SparklesIcon size={14} />
						</div>
					)}

					<div
						className={cn("flex flex-col", {
							"gap-2 md:gap-4": message.parts?.some(
								(p) => p.type === "text" && p.text?.trim(),
							),
							"w-full": message.role === "assistant",
							"max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
								message.role === "user",
						})}
					>
						{message.parts.map((part, index) => (
							<MessagePart
								key={`${message.role}-${part.type}-${index}`}
								part={part}
								partIndex={index}
								messageRole={message.role as "user" | "assistant"}
							/>
						))}
					</div>
				</div>
			</div>
		</ReasoningContext.Provider>
	);
});
