import type { ChatUIMessage } from "@/components/chat/types";

export type ChatStreamStatus = "streaming" | "submitted" | "ready" | "error";

export interface LastCompletePartInfo {
	messageIndex: number;
	partIndex: number;
	hasNextPart: boolean;
	key: string;
}

interface PartPointer {
	messageIndex: number;
	partIndex: number;
}

export function getLastCompletePart(
	messages: ChatUIMessage[],
	streamStatus: ChatStreamStatus,
): LastCompletePartInfo | null {
	if (messages.length === 0) return null;

	const lastPart = getPrecedingPart(messages, {
		messageIndex: messages.length,
		partIndex: 0,
	});
	if (!lastPart) return null;

	const lastMessage = messages[lastPart.messageIndex];
	const lastMessagePart = lastMessage.parts[lastPart.partIndex];

	if (isPartComplete(lastMessagePart, streamStatus, true)) {
		return {
			messageIndex: lastPart.messageIndex,
			partIndex: lastPart.partIndex,
			hasNextPart: lastPart.messageIndex !== messages.length - 1,
			key: buildCheckpointKey(messages, {
				messageIndex: lastPart.messageIndex,
				partIndex: lastPart.partIndex,
			}),
		};
	}

	const precedingComplete = findPreviousCompletePart(messages, lastPart);
	if (!precedingComplete) return null;

	return {
		messageIndex: precedingComplete.messageIndex,
		partIndex: precedingComplete.partIndex,
		hasNextPart: true,
		key: buildCheckpointKey(messages, precedingComplete),
	};
}

export function sliceMessagesThroughPart(
	messages: ChatUIMessage[],
	checkpoint: LastCompletePartInfo,
): ChatUIMessage[] {
	return messages
		.map((message, messageIndex) => {
			if (messageIndex > checkpoint.messageIndex) return null;
			if (messageIndex < checkpoint.messageIndex) return message;
			return {
				...message,
				parts: message.parts.slice(0, checkpoint.partIndex + 1),
			};
		})
		.filter((message): message is ChatUIMessage => message !== null);
}

function getPrecedingPart(
	messages: ChatUIMessage[],
	args: PartPointer,
): PartPointer | null {
	if (messages.length === 0) return null;

	if (args.messageIndex >= messages.length) {
		let messageIndex = messages.length - 1;
		while (messageIndex >= 0) {
			const parts = messages[messageIndex].parts ?? [];
			if (parts.length > 0) {
				return { messageIndex, partIndex: parts.length - 1 };
			}
			messageIndex -= 1;
		}
		return null;
	}

	const parts = messages[args.messageIndex].parts ?? [];
	if (args.partIndex >= parts.length) {
		if (parts.length === 0) {
			return getPrecedingPart(messages, {
				messageIndex: args.messageIndex,
				partIndex: 0,
			});
		}
		return { messageIndex: args.messageIndex, partIndex: parts.length - 1 };
	}

	if (args.partIndex === 0) {
		let messageIndex = args.messageIndex - 1;
		while (messageIndex >= 0) {
			const messageParts = messages[messageIndex].parts ?? [];
			if (messageParts.length > 0) {
				return { messageIndex, partIndex: messageParts.length - 1 };
			}
			messageIndex -= 1;
		}
		return null;
	}

	return { messageIndex: args.messageIndex, partIndex: args.partIndex - 1 };
}

function isPartComplete(
	part: ChatUIMessage["parts"][number],
	streamStatus: ChatStreamStatus,
	isTailPart: boolean,
): boolean {
	if (part.type === "data-task-coding-v1") {
		return part.data.status !== "loading";
	}

	if (typeof (part as { state?: unknown }).state === "string") {
		const state = (part as { state: string }).state;
		return (
			state === "result" ||
			state === "done" ||
			state === "complete" ||
			state === "output-available" ||
			state === "output-error"
		);
	}

	if (!isTailPart) {
		return true;
	}
	return streamStatus !== "streaming";
}

function findPreviousCompletePart(
	messages: ChatUIMessage[],
	from: PartPointer,
): PartPointer | null {
	let cursor = getPrecedingPart(messages, from);
	while (cursor) {
		const part = messages[cursor.messageIndex]?.parts[cursor.partIndex];
		if (part && isPartComplete(part, "ready", false)) {
			return cursor;
		}
		cursor = getPrecedingPart(messages, cursor);
	}
	return null;
}

function buildCheckpointKey(
	messages: ChatUIMessage[],
	checkpoint: PartPointer,
): string {
	const message = messages[checkpoint.messageIndex];
	return `${message.id}:${checkpoint.partIndex}:${messages.length}`;
}
