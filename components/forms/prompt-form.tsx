"use client";

import { memo, useCallback, useEffect, useState } from "react";
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
import { McpButton } from "@/components/connectors/mcp-button";
import { ImportFromGithubDialog } from "@/components/forms/import-from-github-dialog";
import { ModelSelector } from "@/components/model-selector/model-selector";
import { PermissionModeSelector } from "@/components/settings/permission-mode-selector";
import { Settings } from "@/components/settings/settings";
import { useSettings } from "@/components/settings/use-settings";
import { TaskOptions } from "@/components/task-options/task-options";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputBody,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSpeechButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputController,
} from "@/components/ui/prompt-input";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import type { AppUsage } from "@/lib/ai/usage";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";
import { Icons } from "../icons/icons";

interface PromptFormProps {
	onSubmit: (message: PromptInputMessage) => void;
	className?: string;
	isLoading?: boolean;
	initialSandboxDuration?: number;
	initialModelId?: string;
	usage?: AppUsage; // Optional usage prop for context display
	hideAuxiliaryToolsWhenChatActive?: boolean;
	chatStatus?: "ready" | "submitted" | "streaming" | "error";
	hasChatContext?: boolean;
	enableGithubImport?: boolean;
	editingMessageId?: string | null;
	onCancelEdit?: () => void;
	showPermissionModeSelector?: boolean;
}

export const PromptForm = memo(function PromptForm({
	onSubmit,
	className,
	isLoading,
	initialSandboxDuration,
	initialModelId,
	usage,
	hideAuxiliaryToolsWhenChatActive = false,
	chatStatus = "ready",
	hasChatContext = false,
	enableGithubImport = false,
	editingMessageId = null,
	onCancelEdit,
	showPermissionModeSelector = false,
}: PromptFormProps) {
	const { modelId, setModelId, permissionMode, setPermissionMode } =
		useSettings(initialSandboxDuration, initialModelId);
	const controller = usePromptInputController();
	const [input, setInput] = useLocalStorageValue("prompt-input");
	const [isImportGithubOpen, setIsImportGithubOpen] = useState(false);
	const { selection } = useAppHaptics();

	// Use isLoading prop if provided, otherwise use provided chat status
	const currentStatus = isLoading ? "submitted" : chatStatus;

	const shouldHideAuxiliaryTools =
		hideAuxiliaryToolsWhenChatActive && hasChatContext;
	const usedContextTokens = usage?.inputTokens ?? usage?.totalTokens ?? 0;

	const handleModelChange = useCallback(
		(newModelId: string) => {
			setModelId(newModelId);
			saveModelAsCookie(newModelId);
		},
		[setModelId],
	);

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
				const payload = editingMessageId
					? {
							...message,
							messageId: editingMessageId,
						}
					: message;
				selection();
				onSubmit(payload);
				onCancelEdit?.();
				controller.textInput.clear();
			}
		},
		[onSubmit, controller.textInput, selection, editingMessageId, onCancelEdit],
	);

	useEffect(() => {
		if (!editingMessageId || !onCancelEdit) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onCancelEdit();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [editingMessageId, onCancelEdit]);

	return (
		<div className={className}>
			{editingMessageId && onCancelEdit && (
				<div className="mb-3 flex justify-center">
					<Button
						type="button"
						onClick={onCancelEdit}
						variant="ghost"
						className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/95 px-4 py-1.5 text-sm text-foreground shadow-sm hover:bg-background/95 cursor-pointer"
					>
						<span>Cancel</span>
						<Kbd>Esc</Kbd>
					</Button>
				</div>
			)}
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
							placeholder="Ask to build…"
							disabled={
								currentStatus === "streaming" || currentStatus === "submitted"
							}
							className="flex-1 min-w-0"
						/>
						{hasChatContext && usage && usedContextTokens > 0 && (
							<div className="shrink-0">
								<Context
									modelId={modelId}
									usage={usage}
									usedTokens={usedContextTokens}
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
							<PromptInputActionMenuTrigger onClick={selection} />
							<PromptInputActionMenuContent>
								{enableGithubImport && (
									<PromptInputActionMenuItem
										className="cursor-pointer"
										onSelect={(event) => {
											event.preventDefault();
											selection();
											setIsImportGithubOpen(true);
										}}
									>
										<Icons.gitHub className="size-4 mr-2" />
										Import from GitHub
									</PromptInputActionMenuItem>
								)}
								<PromptInputActionAddAttachments />
							</PromptInputActionMenuContent>
						</PromptInputActionMenu>
						{/* Hide MCP and Sandbox buttons when in project/split view */}
						{!shouldHideAuxiliaryTools && (
							<>
								<McpButton />
								<TaskOptions initialSandboxDuration={initialSandboxDuration} />
							</>
						)}
						<Settings />
						<ModelSelector
							modelId={modelId}
							onModelChange={handleModelChange}
						/>
					</PromptInputTools>
					<div className="ml-auto flex items-center gap-1">
						<PromptInputSpeechButton
							disabled={
								currentStatus === "streaming" || currentStatus === "submitted"
							}
						/>
						<PromptInputSubmit
							status={currentStatus}
							disabled={
								currentStatus !== "ready" ||
								(!controller.textInput.value.trim() &&
									!controller.attachments.files.length)
							}
						/>
					</div>
				</PromptInputFooter>
			</PromptInput>
			{showPermissionModeSelector && (
				<div className="mt-2 flex items-center gap-1">
					<PermissionModeSelector
						value={permissionMode}
						onValueChange={setPermissionMode}
					/>
					<div className="flex-1" />
				</div>
			)}
			{enableGithubImport && (
				<ImportFromGithubDialog
					open={isImportGithubOpen}
					onOpenChange={setIsImportGithubOpen}
				/>
			)}
		</div>
	);
});
