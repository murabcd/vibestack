"use client";

import type { ChatUIMessage } from "@/components/chat/types";
import { MessageCircleIcon } from "lucide-react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message } from "@/components/chat/message";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { useChat } from "@ai-sdk/react";
import { useEffect } from "react";
import { useSharedChatContext } from "@/lib/chat-context";
import { useSandboxStore } from "./state";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PromptForm } from "@/components/prompt-form";
import { PromptInputProvider } from "@/components/ui/prompt-input";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { useSettings } from "@/components/settings/use-settings";
import type { PromptInputMessage } from "@/components/ui/prompt-input";

interface Props {
	className: string;
	modelId?: string;
}

function ChatInner({ className }: Props) {
	const { chat } = useSharedChatContext();
	const { messages, sendMessage, status } = useChat<ChatUIMessage>({ chat });
	const { setChatStatus } = useSandboxStore();
	const { modelId, reasoningEffort } = useSettings();

	const handleMessageSubmit = (message: PromptInputMessage) => {
		sendMessage(
			{
				...message,
				text: message.text || "",
			},
			{
				body: {
					modelId,
					reasoningEffort,
				},
			},
		);
	};

	useEffect(() => {
		setChatStatus(status);
	}, [status, setChatStatus]);

	return (
		<Panel className={className}>
			<PanelHeader>
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<MessageCircleIcon className="size-3" />
					<span className="font-medium">Chat</span>
				</div>
				<div className="ml-auto text-xs text-muted-foreground tabular-nums">
					[{status}]
				</div>
			</PanelHeader>

			<Conversation className="relative w-full">
				<ConversationContent className="space-y-4">
					{messages.map((message) => (
						<Message key={message.id} message={message} />
					))}
					{/* Show "Thinking" shimmer when processing */}
					{status === "submitted" && (
						<div className="mr-20">
							<Shimmer duration={1.5} className="text-sm text-muted-foreground">
								Thinking…
							</Shimmer>
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="p-4">
				<PromptForm onSubmit={handleMessageSubmit} />
			</div>
		</Panel>
	);
}

export function Chat(props: Props) {
	const [storedInput] = useLocalStorageValue("prompt-input");

	return (
		<PromptInputProvider initialInput={storedInput || ""}>
			<ChatInner {...props} />
		</PromptInputProvider>
	);
}
