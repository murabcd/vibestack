"use client";

import type { ChatUIMessage } from "@/components/chat/types";
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
	PromptInputTools,
	PromptInputSubmit,
	PromptInputTextarea,
	usePromptInputController,
	type PromptInputMessage,
} from "@/components/ui/prompt-input";
import { ModelSelector } from "@/components/model-selector/model-selector";
import { Settings } from "@/components/settings/settings";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect } from "react";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { useSharedChatContext } from "@/lib/chat-context";
import { useSettings, useModelId } from "@/components/settings/use-settings";
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

interface PromptFormProps {
	onSubmit: (message: PromptInputMessage) => void;
	className?: string;
}

export function PromptForm({ onSubmit, className }: PromptFormProps) {
	const { chat } = useSharedChatContext();
	const { modelId } = useSettings();
	const [, setModelId] = useModelId();
	const { messages, status } = useChat<ChatUIMessage>({ chat });
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
				onSubmit(message);
				controller.textInput.clear();
			}
		},
		[onSubmit, controller.textInput],
	);

	return (
		<div className={className}>
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
						<ModelSelector modelId={modelId} onModelChange={setModelId} />
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
	);
}
