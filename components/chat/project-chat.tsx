"use client";

import { useChat } from "@ai-sdk/react";
import { MessageCircleIcon } from "lucide-react";
import { type MutableRefObject, useEffect, useRef } from "react";
import { useSandboxStore } from "@/app/state";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Message } from "@/components/chat/message";
import type { ChatUIMessage } from "@/components/chat/types";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { PromptForm } from "@/components/forms/prompt-form";
import { useSettings } from "@/components/settings/use-settings";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { PromptInputProvider } from "@/components/ui/prompt-input";
import { useSharedChatContext } from "@/lib/chat-context";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

interface Props {
	className: string;
	modelId?: string;
	initialMessages: ChatUIMessage[];
	projectId: string;
	pendingMessage?: PromptInputMessage | null;
	sentMessageRef?: MutableRefObject<boolean>;
	initialSandboxDuration?: number;
}

function ProjectChatInner({
	className,
	initialMessages,
	projectId,
	pendingMessage,
	sentMessageRef,
	initialSandboxDuration,
}: Props) {
	const { chat } = useSharedChatContext();
	const { modelId, reasoningEffort, sandboxDuration } = useSettings(
		initialSandboxDuration,
	);

	const { messages, sendMessage, status, setMessages } = useChat<ChatUIMessage>(
		{
			chat,
		},
	);
	const { setChatStatus } = useSandboxStore();
	// Local ref - always create it (hooks must be called unconditionally)
	const localSentRef = useRef(false);
	// Use shared ref if provided (to prevent duplicate sends from mobile + desktop renders)
	// Otherwise use local ref
	const hasSentPendingMessage = sentMessageRef ?? localSentRef;
	const hasInitializedMessages = useRef(false);

	// Send pending message if it exists (first message from home page)
	// Only runs once due to shared ref guard across both mobile and desktop components
	// biome-ignore lint/correctness/useExhaustiveDependencies: hasSentPendingMessage is a ref and doesn't need to be in deps
	useEffect(() => {
		if (pendingMessage && !hasSentPendingMessage.current) {
			hasSentPendingMessage.current = true;

			// Send message immediately when component is ready
			sendMessage(
				{
					...pendingMessage,
					text: pendingMessage.text || "",
				},
				{
					body: {
						modelId,
						reasoningEffort,
						projectId,
						sandboxDuration,
					},
				},
			);
		}
		// Note: hasSentPendingMessage is a ref and doesn't need to be in deps
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingMessage, projectId, modelId, reasoningEffort, sendMessage]);

	// Initialize messages from database if available and no pending message
	// Only runs once due to ref guard
	useEffect(() => {
		if (
			!pendingMessage &&
			initialMessages.length > 0 &&
			!hasInitializedMessages.current
		) {
			hasInitializedMessages.current = true;
			setMessages(initialMessages);
		}
	}, [pendingMessage, initialMessages, setMessages]);

	// Initialize Zustand sandbox store from loaded messages (for page refresh)
	// This extracts sandbox data from message content and populates the store
	useEffect(() => {
		if (initialMessages.length > 0) {
			const { setSandboxId, setUrl, addPaths } = useSandboxStore.getState();

			// Parse all messages to extract sandbox data
			for (const message of initialMessages) {
				if (message.role === "assistant" && message.parts) {
					for (const part of message.parts) {
						// Extract sandbox ID from create-sandbox tool
						if (
							part.type === "tool-createSandbox" &&
							part.state === "output-available"
						) {
							const sandboxIdMatch = part.output?.match(/sbx_[a-zA-Z0-9]+/);
							if (sandboxIdMatch) {
								setSandboxId(sandboxIdMatch[0]);
							}
						}

						// Extract URL from get-sandbox-url tool
						if (
							part.type === "tool-getSandboxURL" &&
							part.state === "output-available" &&
							part.output?.url
						) {
							setUrl(part.output.url, crypto.randomUUID());
						}

						// Extract file paths from generate-files tool
						if (
							part.type === "tool-generateFiles" &&
							part.state === "output-available" &&
							part.input?.paths
						) {
							addPaths(part.input.paths);
						}
					}
				}
			}
		}
	}, [initialMessages]);

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
					projectId, // Pass projectId to save messages to the correct project
					sandboxDuration,
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
				<PromptForm
					onSubmit={handleMessageSubmit}
					initialSandboxDuration={initialSandboxDuration}
				/>
			</div>
		</Panel>
	);
}

export function ProjectChat(props: Props) {
	const [storedInput] = useLocalStorageValue("prompt-input");

	// Don't use stored input if we have a pending message (first message)
	const initialInput = props.pendingMessage ? "" : storedInput || "";

	return (
		<PromptInputProvider initialInput={initialInput}>
			<ProjectChatInner {...props} />
		</PromptInputProvider>
	);
}
