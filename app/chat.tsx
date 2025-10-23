"use client";

import type { ChatUIMessage } from "@/components/chat/types";
import { TEST_PROMPTS } from "@/lib/ai/constants";
import { MessageCircleIcon } from "lucide-react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputBody,
	PromptInputFooter,
	PromptInputProvider,
	PromptInputTools,
	PromptInputSubmit,
	PromptInputTextarea,
	usePromptInputController,
	type PromptInputMessage,
} from "@/components/ui/prompt-input";
import { Message } from "@/components/chat/message";
import { ModelSelector } from "@/components/settings/model-selector";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { Settings } from "@/components/settings/settings";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect } from "react";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { useSharedChatContext } from "@/lib/chat-context";
import { useSettings } from "@/components/settings/use-settings";
import { useSandboxStore } from "./state";
import {
	Context,
	ContextCacheUsage,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextTrigger,
} from "@/components/ai-elements/context";
import { Shimmer } from "@/components/ai-elements/shimmer";

interface Props {
	className: string;
	modelId?: string;
}

function ChatInner({ className }: Props) {
	const { chat } = useSharedChatContext();
	const { modelId, reasoningEffort } = useSettings();
	const { messages, sendMessage, status } = useChat<ChatUIMessage>({ chat });
	const { setChatStatus } = useSandboxStore();
	const controller = usePromptInputController();
	const [input, setInput] = useLocalStorageValue("prompt-input");

	// Calculate total token usage from all messages
	const calculateTotalUsage = () => {
		let totalTokens = 0;
		let inputTokens = 0;
		let outputTokens = 0;
		let reasoningTokens = 0;
		let cacheTokens = 0;

		messages.forEach((message) => {
			if (message.role === "assistant" && message.metadata?.usage) {
				const usage = message.metadata.usage;
				totalTokens += usage.totalTokens || 0;
				inputTokens += usage.inputTokens || 0;
				outputTokens += usage.outputTokens || 0;
				reasoningTokens += usage.reasoningTokens || 0;
				cacheTokens += usage.cachedInputTokens || 0;
			}
		});

		return {
			totalTokens,
			inputTokens,
			outputTokens,
			reasoningTokens,
			cachedInputTokens: cacheTokens,
		};
	};

	const totalUsage = calculateTotalUsage();

	useEffect(() => {
		const currentValue = controller.textInput.value;
		if (currentValue !== input) {
			setInput(currentValue);
		}
	}, [controller.textInput.value, input, setInput]);

	const validateAndSubmitMessage = useCallback(
		(message: PromptInputMessage) => {
			const hasText = Boolean(message.text?.trim());
			const hasAttachments = Boolean(message.files?.length);

			if (hasText || hasAttachments) {
				sendMessage(message, { body: { modelId, reasoningEffort } });
				controller.textInput.clear();
			}
		},
		[sendMessage, modelId, controller.textInput, reasoningEffort],
	);

	useEffect(() => {
		setChatStatus(status);
	}, [status, setChatStatus]);

	return (
		<Panel className={className}>
			<PanelHeader>
				<div className="flex items-center text-xs">
					<MessageCircleIcon className="w-3 mr-1.5" />
					Chat
				</div>
				<div className="ml-auto text-xs text-muted-foreground">[{status}]</div>
			</PanelHeader>

			{messages.length === 0 ? (
				<div className="flex-1 min-h-0">
					<div className="flex flex-col justify-center items-center h-full text-base text-muted-foreground">
						<p className="flex items-center">
							Click and try one of these prompts:
						</p>
						<div className="p-4 space-y-1 text-center">
							{TEST_PROMPTS.map((prompt) => (
								<button
									key={prompt}
									type="button"
									className="block w-full px-4 py-2 rounded-sm border border-dashed shadow-sm cursor-pointer border-border hover:bg-secondary/50 hover:text-primary text-left text-sm"
									onClick={() => {
										controller.textInput.setInput(prompt);
									}}
								>
									{prompt}
								</button>
							))}
						</div>
					</div>
				</div>
			) : (
				<Conversation className="relative w-full">
					<ConversationContent className="space-y-4">
						{messages.map((message) => (
							<Message key={message.id} message={message} />
						))}
						{/* Show "Thinking" shimmer when processing */}
						{status === "submitted" && (
							<div className="mr-20">
								<Shimmer
									duration={1.5}
									className="text-sm text-muted-foreground"
								>
									Thinking...
								</Shimmer>
							</div>
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>
			)}

			<div className="p-4">
				<PromptInput
					accept="image/*"
					multiple
					globalDrop
					onSubmit={(message, event) => {
						event.preventDefault();
						validateAndSubmitMessage(message);
					}}
				>
					<PromptInputBody>
						<PromptInputAttachments>
							{(attachment) => <PromptInputAttachment data={attachment} />}
						</PromptInputAttachments>
						<div className="flex items-start gap-2 w-full">
							<PromptInputTextarea
								placeholder="Type your message..."
								disabled={status === "streaming" || status === "submitted"}
								className="flex-1 min-w-0"
							/>
							{totalUsage.totalTokens > 0 && (
								<div className="shrink-0">
									<Context
										modelId={modelId}
										usage={totalUsage}
										usedTokens={totalUsage.totalTokens || 0}
										maxTokens={200000}
									>
										<ContextTrigger />
										<ContextContent>
											<ContextContentHeader />
											<ContextContentBody>
												<ContextInputUsage />
												<ContextOutputUsage />
												<ContextReasoningUsage />
												<ContextCacheUsage />
											</ContextContentBody>
											<ContextContentFooter />
										</ContextContent>
									</Context>
								</div>
							)}
						</div>
					</PromptInputBody>
					<PromptInputFooter>
						<PromptInputTools>
							<PromptInputActionMenu>
								<PromptInputActionMenuTrigger />
								<PromptInputActionMenuContent>
									<PromptInputActionAddAttachments />
								</PromptInputActionMenuContent>
							</PromptInputActionMenu>
							<Settings />
							<ModelSelector />
						</PromptInputTools>
						<PromptInputSubmit
							status={status}
							disabled={
								status !== "ready" ||
								(!controller.textInput.value.trim() &&
									!controller.attachments.files.length)
							}
						/>
					</PromptInputFooter>
				</PromptInput>
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
