"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect } from "react";
import { saveModelAsCookie } from "@/app/actions";
import {
	Context,
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
import { useModelId, useSettings } from "@/components/settings/use-settings";
import { TaskOptions } from "@/components/task-options/task-options";
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
import type { AppUsage } from "@/lib/ai/usage";
import { useSharedChatContext } from "@/lib/chat-context";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

interface PromptFormProps {
	onSubmit: (message: PromptInputMessage) => void;
	className?: string;
	isLoading?: boolean;
	initialSandboxDuration?: number;
	initialModelId?: string;
	usage?: AppUsage; // Optional usage prop for context display
}

export function PromptForm({
	onSubmit,
	className,
	isLoading,
	initialSandboxDuration,
	initialModelId,
	usage,
}: PromptFormProps) {
	const { chat } = useSharedChatContext();
	const { modelId, setModelId } = useSettings(initialSandboxDuration, initialModelId);
	const { messages, status } = useChat<ChatUIMessage>({ chat });
	const controller = usePromptInputController();
	const [input, setInput] = useLocalStorageValue("prompt-input");

	// Use isLoading prop if provided, otherwise use chat status
	const currentStatus = isLoading ? "submitted" : status;

	// Only show context if we have a chat context (not on home page)
	const hasChatContext = chat && messages.length > 0;

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
						{hasChatContext && usage && (usage.totalTokens ?? 0) > 0 && (
							<div className="shrink-0">
								<Context
									modelId={modelId}
									usage={usage}
									usedTokens={usage.totalTokens || 0}
								>
									<ContextTrigger />
									<ContextContent>
										<ContextContentHeader />
										<ContextContentBody>
											<ContextInputUsage />
											<ContextOutputUsage />
											<ContextReasoningUsage />
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
						<ModelSelector 
							modelId={modelId} 
							onModelChange={(newModelId) => {
								setModelId(newModelId);
								saveModelAsCookie(newModelId);
							}} 
						/>
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
