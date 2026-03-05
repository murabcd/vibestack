"use client";

import { useChat } from "@ai-sdk/react";
import { MessageCircleIcon } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSandboxStore } from "@/app/state";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message } from "@/components/chat/message";
import {
	getLastCompletePart,
	sliceMessagesThroughPart,
} from "@/components/chat/stream-persistence";
import type { ChatUIMessage } from "@/components/chat/types";
import { useConnectors } from "@/components/connectors-provider";
import { PromptForm } from "@/components/forms/prompt-form";
import { useAvailableModels } from "@/components/model-selector/use-available-models";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { useSettings } from "@/components/settings/use-settings";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import {
	PromptInputProvider,
	usePromptInputController,
} from "@/components/ui/prompt-input";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import type { AppUsage } from "@/lib/ai/usage";
import { useSharedChatContext } from "@/lib/chat-context";
import { useLocalStorageValue } from "@/lib/use-local-storage-value";

interface Props {
	className: string;
	modelId?: string;
	initialMessages: ChatUIMessage[];
	projectId: string;
	pendingMessage?: PromptInputMessage | null;
	sentMessageRef?: RefObject<boolean>;
	initialSandboxDuration?: number;
	initialLastContext?: AppUsage;
	initialModelId?: string;
}

function dedupeMessagesById(messages: ChatUIMessage[]): ChatUIMessage[] {
	const seen = new Set<string>();
	const dedupedReversed: ChatUIMessage[] = [];
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (seen.has(message.id)) continue;
		seen.add(message.id);
		dedupedReversed.push(message);
	}
	return dedupedReversed.reverse();
}

function ProjectChatInner({
	className,
	initialMessages,
	projectId,
	pendingMessage,
	sentMessageRef,
	initialSandboxDuration,
	initialLastContext,
	initialModelId,
}: Props) {
	const { chat } = useSharedChatContext();
	const { modelId, reasoningEffort, sandboxDuration, permissionMode } =
		useSettings(initialSandboxDuration, initialModelId);
	const { connectors } = useConnectors();
	const { models } = useAvailableModels();
	const connectedServerIds = useMemo(
		() => connectors.filter((c) => c.status === "connected").map((c) => c.id),
		[connectors],
	);
	const currentModel = models.find((model) => model.id === modelId);
	const modelLabel = currentModel?.label || modelId;
	const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const controller = usePromptInputController();

	const {
		messages,
		sendMessage,
		status,
		setMessages,
		addToolApprovalResponse,
	} = useChat<ChatUIMessage>({
		chat,
		experimental_throttle: 50,
	});
	const uniqueMessages = useMemo(
		() => dedupeMessagesById(messages),
		[messages],
	);

	const { setChatStatus } = useSandboxStore();
	const { success, error } = useAppHaptics();
	const localSentRef = useRef(false);
	const hasSentPendingMessage = sentMessageRef ?? localSentRef;
	const hasInitializedMessages = useRef(false);
	const previousStatusRef = useRef(status);
	const statusRef = useRef(status);
	const lastPersistedCheckpointRef = useRef<string | null>(null);
	const persistDebounceTimerRef = useRef<number | null>(null);
	const backgroundPollTimerRef = useRef<number | null>(null);

	const waitForProject = async () => {
		const maxAttempts = 20;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const response = await fetch(`/api/projects/${projectId}`, {
				cache: "no-store",
			});
			if (response.ok) {
				return true;
			}
			if (response.status !== 404) {
				return false;
			}
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		return false;
	};

	const listSandboxPaths = useCallback(async (sandboxId: string) => {
		const response = await fetch(
			`/api/sandboxes/${sandboxId}/files?mode=list`,
			{
				cache: "no-store",
			},
		);
		if (!response.ok) return [] as string[];
		const payload = (await response.json()) as { paths?: unknown };
		if (!Array.isArray(payload.paths)) return [] as string[];
		return payload.paths.filter(
			(path): path is string => typeof path === "string",
		);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: projectId reset is intentional
	useEffect(() => {
		setMessages([]);
		hasInitializedMessages.current = false;
		setEditingMessageId(null);
		lastPersistedCheckpointRef.current = null;
		if (persistDebounceTimerRef.current) {
			window.clearTimeout(persistDebounceTimerRef.current);
			persistDebounceTimerRef.current = null;
		}
		if (backgroundPollTimerRef.current) {
			window.clearInterval(backgroundPollTimerRef.current);
			backgroundPollTimerRef.current = null;
		}

		if (!sentMessageRef) {
			localSentRef.current = false;
		}
	}, [projectId, sentMessageRef, setMessages]);

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
						projectId,
						sandboxDuration,
						permissionMode,
						mcpServerIds:
							connectedServerIds.length > 0 ? connectedServerIds : undefined,
						background: false,
					},
				},
			);
			if (message.messageId) {
				setEditingMessageId(null);
			}
		},
		[
			sendMessage,
			modelId,
			reasoningEffort,
			projectId,
			sandboxDuration,
			permissionMode,
			connectedServerIds,
		],
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
			const previousMessages = messages;
			const messageIndex = messages.findIndex(
				(message) => message.id === messageId,
			);
			if (messageIndex === -1) return;

			const shouldRemoveAssistantReply =
				messages[messageIndex]?.role === "user" &&
				messages[messageIndex + 1]?.role === "assistant";
			const deleteCount = shouldRemoveAssistantReply ? 2 : 1;
			const nextMessages = [
				...messages.slice(0, messageIndex),
				...messages.slice(messageIndex + deleteCount),
			];
			setMessages(nextMessages);

			if (editingMessageId === messageId) {
				handleCancelEdit();
			}

			void (async () => {
				try {
					const response = await fetch(`/api/projects/${projectId}/messages`, {
						method: "PATCH",
						keepalive: true,
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ messages: nextMessages }),
					});

					if (!response.ok) {
						throw new Error(`Persist delete failed: ${response.status}`);
					}
				} catch {
					setMessages(previousMessages);
				}
			})();
		},
		[messages, setMessages, editingMessageId, handleCancelEdit, projectId],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: hasSentPendingMessage is a stable ref
	useEffect(() => {
		const sendPendingMessage = async () => {
			if (!pendingMessage || hasSentPendingMessage.current) {
				return;
			}
			hasSentPendingMessage.current = true;

			const projectReady = await waitForProject();
			if (!projectReady) {
				hasSentPendingMessage.current = false;
				console.error("[ProjectChat] Project was not ready for first message");
				return;
			}

			sessionStorage.removeItem(`pending-message-${projectId}`);
			handleMessageSubmit({
				...pendingMessage,
				text: pendingMessage.text || "",
			});
		};

		void sendPendingMessage();
	}, [
		pendingMessage,
		projectId,
		modelId,
		reasoningEffort,
		sandboxDuration,
		connectedServerIds,
	]);

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

	useEffect(() => {
		if (uniqueMessages.length === messages.length) return;
		setMessages(uniqueMessages);
	}, [messages.length, setMessages, uniqueMessages]);

	useEffect(() => {
		for (let i = uniqueMessages.length - 1; i >= 0; i--) {
			const message = uniqueMessages[i];
			if (message.role === "assistant" && message.metadata?.usage) {
				setUsage(message.metadata.usage);
				break;
			}
		}
	}, [uniqueMessages]);

	useEffect(() => {
		const { reset, setSandboxId, setUrl, addPaths } =
			useSandboxStore.getState();
		let cancelled = false;
		const hydratePathsFromSandbox = (sandboxId: string) => {
			void listSandboxPaths(sandboxId)
				.then((paths) => {
					if (cancelled || paths.length === 0) return;
					addPaths(paths);
				})
				.catch(() => {
					// Best-effort hydration fallback.
				});
		};
		reset();

		if (initialMessages.length === 0) {
			if (typeof window !== "undefined") {
				try {
					const raw = sessionStorage.getItem(
						`imported-project-state-${projectId}`,
					);
					if (raw) {
						const parsed = JSON.parse(raw) as {
							sandboxId?: unknown;
							url?: unknown;
							paths?: unknown;
						};
						const importedSandboxId =
							typeof parsed.sandboxId === "string"
								? parsed.sandboxId
								: undefined;
						const importedUrl =
							typeof parsed.url === "string" ? parsed.url : undefined;
						const importedPaths = Array.isArray(parsed.paths)
							? parsed.paths.filter(
									(path): path is string => typeof path === "string",
								)
							: [];
						if (importedSandboxId) {
							setSandboxId(importedSandboxId);
							if (importedUrl) {
								setUrl(importedUrl, crypto.randomUUID());
							}
						}
						if (importedPaths.length > 0) {
							addPaths(importedPaths);
						} else if (importedSandboxId) {
							hydratePathsFromSandbox(importedSandboxId);
						}
						sessionStorage.removeItem(`imported-project-state-${projectId}`);
					}
				} catch {
					sessionStorage.removeItem(`imported-project-state-${projectId}`);
				}
			}
			return () => {
				cancelled = true;
			};
		}

		let hydratedSandboxId: string | undefined;
		let hydratedUrl: string | undefined;
		const hydratedPaths: string[] = [];

		for (const message of initialMessages) {
			if (message.role !== "assistant" || !message.parts) continue;

			for (const part of message.parts) {
				if (part.type === "data-task-coding-v1") {
					const lastPart = part.data.parts[part.data.parts.length - 1];
					if (lastPart && typeof lastPart === "object") {
						const taskPartType =
							typeof (lastPart as { type?: unknown }).type === "string"
								? (lastPart as { type: string }).type
								: "";

						if (taskPartType === "create-sandbox-complete") {
							const sandboxId = (lastPart as { sandboxId?: unknown }).sandboxId;
							if (typeof sandboxId === "string") {
								hydratedSandboxId = sandboxId;
							}
						}

						if (taskPartType === "get-sandbox-url-complete") {
							const url = (lastPart as { url?: unknown }).url;
							if (typeof url === "string") {
								hydratedUrl = url;
							}
						}

						if (
							(taskPartType === "generated-files-uploaded" ||
								taskPartType === "generated-files-complete") &&
							Array.isArray((lastPart as { paths?: unknown }).paths)
						) {
							hydratedPaths.push(
								...(
									(lastPart as { paths?: unknown }).paths as unknown[]
								).filter((path): path is string => typeof path === "string"),
							);
						}
					}
				}

				if (
					part.type === "tool-createSandbox" &&
					part.state === "output-available"
				) {
					const output = (part as { output?: unknown }).output;

					if (typeof output === "string") {
						const sandboxIdMatch = output.match(/sbx_[a-zA-Z0-9_-]+/);
						if (sandboxIdMatch) {
							hydratedSandboxId = sandboxIdMatch[0];
						}
					}

					if (
						output &&
						typeof output === "object" &&
						"sandboxId" in output &&
						typeof output.sandboxId === "string"
					) {
						hydratedSandboxId = output.sandboxId;
					}
				}

				if (
					part.type === "tool-getSandboxURL" &&
					part.state === "output-available"
				) {
					const output = (part as { output?: unknown }).output;

					if (
						output &&
						typeof output === "object" &&
						"url" in output &&
						typeof output.url === "string"
					) {
						hydratedUrl = output.url;
					}
				}

				if (
					part.type === "tool-generateFiles" &&
					part.state === "output-available" &&
					part.input?.paths
				) {
					hydratedPaths.push(...part.input.paths);
				}
			}
		}

		if (hydratedSandboxId) {
			setSandboxId(hydratedSandboxId);
			if (hydratedUrl) {
				setUrl(hydratedUrl, crypto.randomUUID());
			}
		}
		if (hydratedPaths.length > 0) {
			addPaths(hydratedPaths);
		} else if (hydratedSandboxId) {
			hydratePathsFromSandbox(hydratedSandboxId);
		}
		return () => {
			cancelled = true;
		};
	}, [initialMessages, listSandboxPaths, projectId]);

	useEffect(() => {
		statusRef.current = status;
		setChatStatus(status);
	}, [status, setChatStatus]);

	const persistMessages = useCallback(
		async (nextMessages: ChatUIMessage[]) => {
			const response = await fetch(`/api/projects/${projectId}/messages`, {
				method: "PATCH",
				keepalive: true,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages: nextMessages }),
			});
			if (!response.ok) {
				throw new Error(`Persist replace failed: ${response.status}`);
			}
		},
		[projectId],
	);

	useEffect(() => {
		const checkpoint = getLastCompletePart(uniqueMessages, status);
		if (!checkpoint) return;
		if (checkpoint.key === lastPersistedCheckpointRef.current) return;

		if (persistDebounceTimerRef.current) {
			window.clearTimeout(persistDebounceTimerRef.current);
		}

		const persistableMessages = sliceMessagesThroughPart(
			uniqueMessages,
			checkpoint,
		);
		persistDebounceTimerRef.current = window.setTimeout(() => {
			void persistMessages(persistableMessages)
				.then(() => {
					lastPersistedCheckpointRef.current = checkpoint.key;
				})
				.catch(() => {
					// Best-effort checkpoint persistence; final save still happens server-side.
				});
		}, 220);

		return () => {
			if (persistDebounceTimerRef.current) {
				window.clearTimeout(persistDebounceTimerRef.current);
				persistDebounceTimerRef.current = null;
			}
		};
	}, [persistMessages, status, uniqueMessages]);

	const refreshMessagesFromServer = useCallback(async () => {
		const response = await fetch(`/api/projects/${projectId}/messages`, {
			cache: "no-store",
		});
		if (!response.ok) {
			throw new Error(`Refresh messages failed: ${response.status}`);
		}
		const payload = (await response.json()) as {
			messages?: Array<{ content?: ChatUIMessage }>;
		};
		const serverMessages = Array.isArray(payload.messages)
			? payload.messages
					.map((entry) => entry?.content)
					.filter((message): message is ChatUIMessage =>
						Boolean(message && typeof message === "object"),
					)
			: [];
		setMessages(serverMessages);
		lastPersistedCheckpointRef.current = null;
	}, [projectId, setMessages]);

	const checkLatestRun = useCallback(async (): Promise<
		"queued" | "processing" | "completed" | "error" | null
	> => {
		const response = await fetch(`/api/projects/${projectId}/runs/latest`, {
			cache: "no-store",
		});
		if (!response.ok) return null;

		const payload = (await response.json()) as {
			run?: { status?: "queued" | "processing" | "completed" | "error" };
		};
		return payload.run?.status ?? null;
	}, [projectId]);

	useEffect(() => {
		let cancelled = false;
		const stopPolling = () => {
			if (backgroundPollTimerRef.current) {
				window.clearInterval(backgroundPollTimerRef.current);
				backgroundPollTimerRef.current = null;
			}
		};

		const pollLatestRun = async () => {
			try {
				const latestStatus = await checkLatestRun();
				if (cancelled) return;

				if (latestStatus === "queued" || latestStatus === "processing") {
					if (!backgroundPollTimerRef.current) {
						backgroundPollTimerRef.current = window.setInterval(() => {
							void pollLatestRun();
						}, 3000);
					}
					return;
				}

				stopPolling();
				if (
					(latestStatus === "completed" || latestStatus === "error") &&
					statusRef.current !== "streaming" &&
					statusRef.current !== "submitted"
				) {
					await refreshMessagesFromServer();
				}
			} catch {
				// Ignore background run polling failures.
			}
		};

		void pollLatestRun();
		return () => {
			cancelled = true;
			stopPolling();
		};
	}, [checkLatestRun, refreshMessagesFromServer]);

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
					{modelLabel && (
						<>
							<span className="text-muted-foreground/60">•</span>
							<span className="font-medium">{modelLabel}</span>
						</>
					)}
				</div>
				<div className="ml-auto text-xs text-muted-foreground tabular-nums">
					[{status}]
				</div>
			</PanelHeader>

			<Conversation className="relative w-full">
				<ConversationContent className="space-y-4">
					{uniqueMessages.map((message) => (
						<Message
							key={message.id}
							message={message}
							streamStatus={status}
							onEditMessage={handleEditMessage}
							onDeleteMessage={handleDeleteMessageTurn}
							addToolApprovalResponse={addToolApprovalResponse}
						/>
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="p-4">
				<PromptForm
					onSubmit={handleMessageSubmit}
					initialSandboxDuration={initialSandboxDuration}
					initialModelId={initialModelId}
					usage={usage}
					chatStatus={status}
					hasChatContext
					hideAuxiliaryToolsWhenChatActive
					editingMessageId={editingMessageId}
					onCancelEdit={handleCancelEdit}
				/>
			</div>
		</Panel>
	);
}

export function ProjectChat(props: Props) {
	const [storedInput] = useLocalStorageValue("prompt-input");
	const initialInput = props.pendingMessage ? "" : storedInput || "";

	return (
		<PromptInputProvider initialInput={initialInput}>
			<ProjectChatInner {...props} />
		</PromptInputProvider>
	);
}
