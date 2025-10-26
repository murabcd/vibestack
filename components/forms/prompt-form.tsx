"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect } from "react";
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
import type { ChatUIMessage } from "@/components/chat/types";
import { ModelSelector } from "@/components/model-selector/model-selector";
import { Settings } from "@/components/settings/settings";
import { TaskOptions } from "@/components/task-options/task-options";
import { useModelId, useSettings } from "@/components/settings/use-settings";
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
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputController,
} from "@/components/ui/prompt-input";
import { useSharedChatContext } from "@/lib/chat-context";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

interface PromptFormProps {
	onSubmit: (message: PromptInputMessage) => void;
	className?: string;
	isLoading?: boolean;
	initialSandboxDuration?: number;
}

export function PromptForm({
	onSubmit,
	className,
	isLoading,
	initialSandboxDuration,
}: PromptFormProps) {
	const { chat } = useSharedChatContext();
	const { modelId } = useSettings(initialSandboxDuration);
	const [, setModelId] = useModelId();
	const { messages, status } = useChat<ChatUIMessage>({ chat });
	const controller = usePromptInputController();
	const [input, setInput] = useLocalStorageValue("prompt-input");

	// Use isLoading prop if provided, otherwise use chat status
	const currentStatus = isLoading ? "submitted" : status;

	// Only show context if we have a chat context (not on home page)
	const hasChatContext = chat && messages.length > 0;

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
							placeholder="Type your message…"
							disabled={
								currentStatus === "streaming" || currentStatus === "submitted"
							}
							className="flex-1 min-w-0"
						/>
						{hasChatContext && totalUsage.totalTokens > 0 && (
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
						<TaskOptions initialSandboxDuration={initialSandboxDuration} />
						<Settings />
						<ModelSelector modelId={modelId} onModelChange={setModelId} />
					</PromptInputTools>
					<PromptInputSubmit
						status={currentStatus}
						disabled={
							currentStatus !== "ready" ||
							(!controller.textInput.value.trim() &&
								!controller.attachments.files.length)
						}
					/>
				</PromptInputFooter>
			</PromptInput>
		</div>
	);
}
