"use client";

import { useChat } from "@ai-sdk/react";
import { MessageCircleIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Message } from "@/components/chat/message";
import type { ChatUIMessage } from "@/components/chat/types";
import { PromptForm } from "@/components/forms/prompt-form";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { useSettings } from "@/components/settings/use-settings";
import {
	type PromptInputMessage,
	PromptInputProvider,
	usePromptInputController,
} from "@/components/ui/prompt-input";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import { useSharedChatContext } from "@/lib/chat-context";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { useSandboxStore } from "./state";

interface Props {
	className: string;
	modelId?: string;
}

function ChatInner({ className }: Props) {
	const { chat } = useSharedChatContext();
	const { messages, sendMessage, status, setMessages } = useChat<ChatUIMessage>(
		{
			chat,
		},
	);
	const { setChatStatus } = useSandboxStore();
	const { modelId, reasoningEffort } = useSettings();
	const { success, error } = useAppHaptics();
	const previousStatusRef = useRef(status);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const controller = usePromptInputController();

	const handleMessageSubmit = useCallback(
		(message: PromptInputMessage) => {
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
			if (message.messageId) {
				setEditingMessageId(null);
			}
		},
		[sendMessage, modelId, reasoningEffort],
	);

	const handleEditMessage = useCallback(
		(messageId: string, text: string) => {
			setEditingMessageId(messageId);
			controller.textInput.setInput(text);
		},
		[controller.textInput],
	);

	const handleCancelEdit = useCallback(() => {
		setEditingMessageId(null);
		controller.textInput.clear();
		controller.attachments.clear();
	}, [controller.textInput, controller.attachments]);

	const handleDeleteMessageTurn = useCallback(
		(messageId: string) => {
			const messageIndex = messages.findIndex(
				(message) => message.id === messageId,
			);
			if (messageIndex === -1) return;

			const shouldRemoveAssistantReply =
				messages[messageIndex]?.role === "user" &&
				messages[messageIndex + 1]?.role === "assistant";
			const deleteCount = shouldRemoveAssistantReply ? 2 : 1;
			setMessages([
				...messages.slice(0, messageIndex),
				...messages.slice(messageIndex + deleteCount),
			]);

			if (editingMessageId === messageId) {
				handleCancelEdit();
			}
		},
		[messages, setMessages, editingMessageId, handleCancelEdit],
	);

	useEffect(() => {
		setChatStatus(status);
	}, [status, setChatStatus]);

	useEffect(() => {
		const previousStatus = previousStatusRef.current;

		if (status === "streaming" && previousStatus !== "streaming") {
			success();
		}

		if (previousStatus === "streaming" && status === "ready") {
			success();
		}

		if (status === "error" && previousStatus !== "error") {
			error();
		}

		previousStatusRef.current = status;
	}, [status, success, error]);

	return (
		<Panel className={className}>
			<PanelHeader className="h-10 min-h-10">
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
						<Message
							key={message.id}
							message={message}
							onEditMessage={handleEditMessage}
							onDeleteMessage={handleDeleteMessageTurn}
						/>
					))}
					{/* Show "Thinking" only before the first streamed chunks arrive */}
					{status === "submitted" && (
						<div className="mr-20">
							<Shimmer
								key={`${messages.length}-${status}`}
								duration={1.5}
								className="text-sm text-muted-foreground"
							>
								Thinking…
							</Shimmer>
						</div>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="p-4">
				<PromptForm
					onSubmit={handleMessageSubmit}
					chatStatus={status}
					hasChatContext={messages.length > 0}
					editingMessageId={editingMessageId}
					onCancelEdit={handleCancelEdit}
				/>
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
