"use client";

import { Chat } from "@ai-sdk/react";
import {
	type DataUIPart,
	lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useRef } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { useDataStateMapper } from "@/app/state";
import type { ChatUIMessage } from "@/components/chat/types";
import type { DataPart } from "@/lib/ai/messages/data-parts";
import { logger } from "@/lib/logging/logger";

interface ChatContextValue {
	chat: Chat<ChatUIMessage>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function parseErrorPayload(error: Error): {
	code?: string;
	error?: string;
	provider?: string;
} | null {
	try {
		return JSON.parse(error.message) as {
			code?: string;
			error?: string;
			provider?: string;
		};
	} catch {
		return null;
	}
}

function getChatErrorToast(error: Error): string {
	const payload = parseErrorPayload(error);
	const message = [error.message, payload?.error]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	if (
		payload?.code === "provider_api_key_missing" ||
		message.includes("provider_api_key_missing") ||
		message.includes("api key") ||
		message.includes("loadapikey")
	) {
		return "AI is not configured in this environment yet. Please add the provider API key.";
	}

	if (
		message.includes("authentication required") ||
		message.includes("unauthorized") ||
		message.includes("forbidden") ||
		message.includes("sign in")
	) {
		return "You need to sign in to continue with this project";
	}

	return "Failed to send message. Please try again.";
}

function isExpectedChatTermination(error: Error): boolean {
	const name = error.name.toLowerCase();
	const message = error.message.toLowerCase();
	return (
		name === "aborterror" ||
		message === "terminated" ||
		message.includes("aborted") ||
		message.includes("signal is aborted")
	);
}

export function ChatProvider({ children }: { children: ReactNode }) {
	const mapDataToState = useDataStateMapper();
	const mapDataToStateRef = useRef(mapDataToState);
	mapDataToStateRef.current = mapDataToState;

	const chat = useMemo(
		() =>
			new Chat<ChatUIMessage>({
				onToolCall: () => mutate("/api/auth/info"),
				onData: (data: DataUIPart<DataPart>) => mapDataToStateRef.current(data),
				sendAutomaticallyWhen:
					lastAssistantMessageIsCompleteWithApprovalResponses,
				onError: (error) => {
					if (isExpectedChatTermination(error)) {
						logger.info({
							event: "chat.client.send.terminated",
							error: {
								name: error.name,
								message: error.message,
							},
						});
						return;
					}
					toast.error(getChatErrorToast(error));
					logger.error({
						event: "chat.client.send.failed",
						error: {
							name: error.name,
							message: error.message,
						},
					});
				},
			}),
		[],
	);

	return (
		<ChatContext.Provider value={{ chat }}>{children}</ChatContext.Provider>
	);
}

export function useSharedChatContext() {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error("useSharedChatContext must be used within a ChatProvider");
	}
	return context;
}
