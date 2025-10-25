import { type ClassValue, clsx } from "clsx";
import { formatISO } from "date-fns";
import type { InferSelectModel } from "drizzle-orm";
import { twMerge } from "tailwind-merge";
import type { ChatUIMessage } from "@/components/chat/types";
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

// Convert database messages to UI format for useChat hook
export function convertToUIMessages(messages: Message[]): ChatUIMessage[] {
	return messages.map((message) => ({
		id: message.id,
		role: message.role as "user" | "assistant",
		parts: message.content as ChatUIMessage["parts"], // content is stored as JSONB with parts
		metadata: {
			model: "unknown", // Default model since we don't store this in the database
			createdAt: formatISO(message.createdAt),
		},
	}));
}
