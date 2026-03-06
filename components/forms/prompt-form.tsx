"use client";

import {
	ChevronRightIcon,
	PlusIcon,
	SearchIcon,
	ServerIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { ConnectorDialog } from "@/components/connectors/manage-connectors";
import { useConnectors } from "@/components/connectors-provider";
import { ImportFromGithubDialog } from "@/components/forms/import-from-github-dialog";
import { ModelSelector } from "@/components/model-selector/model-selector";
import { PermissionModeSelector } from "@/components/settings/permission-mode-selector";
import { Settings } from "@/components/settings/settings";
import { useSettings } from "@/components/settings/use-settings";
import { TaskOptions } from "@/components/task-options/task-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import { toggleConnectorStatus } from "@/lib/actions/connectors";
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
	const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);
	const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
	const [actionMenuView, setActionMenuView] = useState<"root" | "mcp">("root");
	const [mcpSearchQuery, setMcpSearchQuery] = useState("");
	const [optimisticConnectorStatus, setOptimisticConnectorStatus] = useState<
		Record<string, "connected" | "disconnected">
	>({});
	const [pendingConnectorIds, setPendingConnectorIds] = useState<Set<string>>(
		new Set(),
	);
	const {
		connectors,
		refreshConnectors,
		isLoading: connectorsLoading,
	} = useConnectors();
	const { selection } = useAppHaptics();

	useEffect(() => {
		if (!isActionMenuOpen) {
			setActionMenuView("root");
			setMcpSearchQuery("");
		}
	}, [isActionMenuOpen]);

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

	const filteredConnectors = useMemo(() => {
		const query = mcpSearchQuery.trim().toLowerCase();
		const sorted = [...connectors].sort((a, b) => {
			const aStatus = optimisticConnectorStatus[a.id] ?? a.status;
			const bStatus = optimisticConnectorStatus[b.id] ?? b.status;
			if (aStatus === bStatus) return a.name.localeCompare(b.name);
			return aStatus === "connected" ? -1 : 1;
		});

		if (!query) return sorted;
		return sorted.filter((connector) =>
			`${connector.name} ${connector.baseUrl ?? ""} ${connector.command ?? ""}`
				.toLowerCase()
				.includes(query),
		);
	}, [connectors, mcpSearchQuery, optimisticConnectorStatus]);

	const selectedMcpCount = useMemo(
		() =>
			connectors.reduce((count, connector) => {
				const status =
					optimisticConnectorStatus[connector.id] ?? connector.status;
				return status === "connected" ? count + 1 : count;
			}, 0),
		[connectors, optimisticConnectorStatus],
	);

	const toggleConnector = useCallback(
		async (id: string, status: "connected" | "disconnected") => {
			const nextStatus = status === "connected" ? "disconnected" : "connected";
			setOptimisticConnectorStatus((previous) => ({
				...previous,
				[id]: nextStatus,
			}));
			setPendingConnectorIds((previous) => new Set(previous).add(id));
			try {
				const result = await toggleConnectorStatus(id, nextStatus);
				if (!result.success) {
					throw new Error(result.message);
				}
				await refreshConnectors();
				setOptimisticConnectorStatus((previous) => {
					const next = { ...previous };
					delete next[id];
					return next;
				});
			} catch {
				setOptimisticConnectorStatus((previous) => ({
					...previous,
					[id]: status,
				}));
			} finally {
				setPendingConnectorIds((previous) => {
					const next = new Set(previous);
					next.delete(id);
					return next;
				});
			}
		},
		[refreshConnectors],
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
						<PromptInputActionMenu
							open={isActionMenuOpen}
							onOpenChange={setIsActionMenuOpen}
						>
							<PromptInputActionMenuTrigger onClick={selection} />
							<PromptInputActionMenuContent
								className={actionMenuView === "mcp" ? "w-64 p-0" : undefined}
							>
								{actionMenuView === "root" ? (
									<>
										<PromptInputActionAddAttachments />
										{enableGithubImport && (
											<PromptInputActionMenuItem
												className="cursor-pointer"
												onSelect={(event) => {
													event.preventDefault();
													selection();
													setIsImportGithubOpen(true);
													setIsActionMenuOpen(false);
												}}
											>
												<Icons.gitHub className="size-4" />
												Import from GitHub
											</PromptInputActionMenuItem>
										)}
										<PromptInputActionMenuItem
											className="cursor-pointer"
											onSelect={(event) => {
												event.preventDefault();
												setActionMenuView("mcp");
											}}
										>
											<ServerIcon className="size-4" />
											Connect MCP
											<span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
												<span>{selectedMcpCount} Selected</span>
												<ChevronRightIcon className="size-3.5 text-muted-foreground" />
											</span>
										</PromptInputActionMenuItem>
									</>
								) : (
									<>
										<div className="border-b p-2">
											<div className="relative">
												<SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
												<Input
													className="h-8 pl-8 pr-2"
													placeholder="Search..."
													value={mcpSearchQuery}
													onChange={(event) =>
														setMcpSearchQuery(event.target.value)
													}
												/>
											</div>
										</div>
										<ScrollArea className="max-h-56">
											<div className="p-1">
												{connectorsLoading ? (
													<div className="px-2 py-4 text-center text-xs text-muted-foreground">
														Loading MCPs...
													</div>
												) : filteredConnectors.length === 0 ? (
													<div className="p-3 text-center">
														<p className="text-xs text-muted-foreground">
															No MCPs added
														</p>
													</div>
												) : (
													filteredConnectors.map((connector) => {
														const isPending = pendingConnectorIds.has(
															connector.id,
														);
														const currentStatus =
															optimisticConnectorStatus[connector.id] ??
															connector.status;
														return (
															/* biome-ignore lint/a11y/useSemanticElements: Avoid nested interactive elements (<button> containing Switch button) while keeping full-row toggle interaction */
															<div
																key={connector.id}
																role="button"
																tabIndex={isPending ? -1 : 0}
																aria-disabled={isPending}
																className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
																onClick={() =>
																	void toggleConnector(
																		connector.id,
																		currentStatus,
																	)
																}
																onKeyDown={(event) => {
																	if (isPending) return;
																	if (
																		event.key === "Enter" ||
																		event.key === " "
																	) {
																		event.preventDefault();
																		void toggleConnector(
																			connector.id,
																			currentStatus,
																		);
																	}
																}}
															>
																<ServerIcon className="size-3.5 text-muted-foreground" />
																<span className="flex-1 truncate text-sm">
																	{connector.name}
																</span>
																<Switch
																	size="sm"
																	className="pointer-events-none"
																	checked={currentStatus === "connected"}
																	disabled={isPending}
																/>
															</div>
														);
													})
												)}
											</div>
										</ScrollArea>
										<div className="border-t p-1">
											<button
												type="button"
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
												onClick={() => {
													selection();
													setMcpSearchQuery("");
													setIsActionMenuOpen(false);
													requestAnimationFrame(() => {
														setIsConnectorDialogOpen(true);
													});
												}}
											>
												<PlusIcon className="size-4 text-muted-foreground" />
												Add MCP
											</button>
										</div>
									</>
								)}
							</PromptInputActionMenuContent>
						</PromptInputActionMenu>
						{/* Hide MCP and Sandbox buttons when in project/split view */}
						{!shouldHideAuxiliaryTools && !showPermissionModeSelector && (
							<TaskOptions initialSandboxDuration={initialSandboxDuration} />
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
					<TaskOptions
						initialSandboxDuration={initialSandboxDuration}
						compact
					/>
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
			<ConnectorDialog
				open={isConnectorDialogOpen}
				onOpenChange={setIsConnectorDialogOpen}
			/>
		</div>
	);
});
