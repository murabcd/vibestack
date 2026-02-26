import { type ClassValue, clsx } from "clsx";
import { validateUIMessages } from "ai";
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
// Supports both legacy rows (content = parts[]) and v6-aligned rows (content = full UIMessage).
export async function convertToUIMessages(
	messages: Message[],
): Promise<ChatUIMessage[]> {
	const mappedMessages = messages.map((message) => {
		const content = message.content as unknown;

		// v6-aligned persisted format: full UIMessage object
		if (
			typeof content === "object" &&
			content !== null &&
			"id" in content &&
			"role" in content &&
			"parts" in content
		) {
			return content as ChatUIMessage;
		}

		// Legacy persisted format: parts only
		return {
			id: message.id,
			role: message.role as "user" | "assistant",
			parts: content as ChatUIMessage["parts"],
			metadata: {
				model: "unknown",
			},
		} satisfies ChatUIMessage;
	});

	try {
		return await validateUIMessages<ChatUIMessage>({
			messages: mappedMessages,
			metadataSchema,
			dataSchemas: dataPartSchema.shape,
		});
	} catch {
		// Fallback to unvalidated mapped messages to avoid blocking page load on malformed rows.
		return mappedMessages;
	}
}
