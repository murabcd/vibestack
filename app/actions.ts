"use server";

import { generateText } from "ai";
import type { ChatUIMessage } from "@/components/chat/types";
import { createOpenAI } from "@ai-sdk/openai";

export async function generateTitleFromUserMessage({
	message,
}: {
	message: ChatUIMessage;
}) {
	try {
		const openai = createOpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});

		const { text: title } = await generateText({
			model: openai("gpt-4.1-nano"),
			system: `Generate a short title (max 80 characters) based on the user's message. 
			The title should be a summary of what the user wants to create or build.
			Do not use quotes or colons.`,
			prompt: message.parts
				.map((part) => (part.type === "text" ? part.text : ""))
				.join(" "),
		});

		return title;
	} catch (error) {
		console.error("Failed to generate title:", error);
		// Fallback to first 50 characters of the message
		const textContent = message.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join(" ");
		return textContent.slice(0, 50) || "New Project";
	}
}
