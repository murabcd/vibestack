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
import type { ChatUIMessage } from "@/components/chat/types";
import { useConnectors } from "@/components/connectors-provider";
import { PromptForm } from "@/components/forms/prompt-form";
import { useAvailableModels } from "@/components/model-selector/use-available-models";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { useSettings } from "@/components/settings/use-settings";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { PromptInputProvider } from "@/components/ui/prompt-input";
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
	const { modelId, reasoningEffort, sandboxDuration } = useSettings(
		initialSandboxDuration,
		initialModelId,
	);
	const { connectors } = useConnectors();
	const { models } = useAvailableModels();
	const connectedServerIds = useMemo(
		() => connectors.filter((c) => c.status === "connected").map((c) => c.id),
		[connectors],
	);
	const currentModel = models.find((model) => model.id === modelId);
	const modelLabel = currentModel?.label || modelId;
	const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);

	const { messages, sendMessage, status, setMessages } = useChat<ChatUIMessage>(
		{
			chat,
		},
	);

	const { setChatStatus } = useSandboxStore();
	const localSentRef = useRef(false);
	const hasSentPendingMessage = sentMessageRef ?? localSentRef;
	const hasInitializedMessages = useRef(false);

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: projectId reset is intentional
	useEffect(() => {
		setMessages([]);
		hasInitializedMessages.current = false;

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
						mcpServerIds:
							connectedServerIds.length > 0 ? connectedServerIds : undefined,
						background: false,
					},
				},
			);
		},
		[
			sendMessage,
			modelId,
			reasoningEffort,
			projectId,
			sandboxDuration,
			connectedServerIds,
		],
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
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			if (message.role === "assistant" && message.metadata?.usage) {
				setUsage(message.metadata.usage);
				break;
			}
		}
	}, [messages]);

	useEffect(() => {
		const { reset, setSandboxId, setUrl, addPaths } =
			useSandboxStore.getState();
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
						}
						sessionStorage.removeItem(`imported-project-state-${projectId}`);
					}
				} catch {
					sessionStorage.removeItem(`imported-project-state-${projectId}`);
				}
			}
			return;
		}

		let hydratedSandboxId: string | undefined;
		let hydratedUrl: string | undefined;

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
							addPaths(
								((lastPart as { paths?: unknown }).paths as unknown[]).filter(
									(path): path is string => typeof path === "string",
								),
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
					addPaths(part.input.paths);
				}
			}
		}

		if (hydratedSandboxId) {
			setSandboxId(hydratedSandboxId);
			if (hydratedUrl) {
				setUrl(hydratedUrl, crypto.randomUUID());
			}
		}
	}, [initialMessages, projectId]);

	useEffect(() => {
		setChatStatus(status);
	}, [status, setChatStatus]);

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
					{messages.map((message) => (
						<Message key={message.id} message={message} />
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
					hasChatContext={messages.length > 0}
					hideAuxiliaryToolsWhenChatActive
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
