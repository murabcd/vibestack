import { validateUIMessages } from "ai";
import { type ClassValue, clsx } from "clsx";
import type { InferSelectModel } from "drizzle-orm";
import { twMerge } from "tailwind-merge";
import type { ChatUIMessage } from "@/components/chat/types";
import { dataPartSchema } from "@/lib/ai/messages/data-parts";
import { metadataSchema } from "@/lib/ai/messages/metadata";
import type { messages } from "@/lib/db/schema";

type Message = InferSelectModel<typeof messages>;

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// Convert database messages to validated UI format for useChat hook.
// Expects v6-aligned persisted rows where content is a full UIMessage.
export async function convertToUIMessages(
	messages: Message[],
): Promise<ChatUIMessage[]> {
	if (messages.length === 0) {
		return [];
	}

	return validateUIMessages<ChatUIMessage>({
		messages: messages.map((message) => message.content as ChatUIMessage),
		metadataSchema,
		dataSchemas: dataPartSchema.shape,
	});
}
