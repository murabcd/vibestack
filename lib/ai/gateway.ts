import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { JSONValue, LanguageModel } from "ai";
import { env } from "@/lib/env";
import { Models } from "./constants";

const anthropic = createAnthropic({
	apiKey: env.ANTHROPIC_API_KEY,
});
const openai = createOpenAI({
	apiKey: env.OPENAI_API_KEY,
});

const AVAILABLE_MODELS = [
	{ id: Models.AnthropicClaude46Opus, name: "Opus 4.6" },
	{ id: Models.AnthropicClaude45Sonnet, name: "Sonnet 4.5" },
	{ id: Models.AnthropicClaude45Haiku, name: "Haiku 4.5" },
	{ id: Models.OpenAIGpt52, name: "GPT 5.2" },
	{ id: Models.OpenAIGpt5Mini, name: "GPT 5 Mini" },
	{ id: Models.OpenAIGpt5Nano, name: "GPT 5 Nano" },
];

export async function getAvailableModels() {
	return AVAILABLE_MODELS;
}

export interface ModelOptions {
	model: LanguageModel;
	providerOptions?: Record<string, Record<string, JSONValue>>;
	headers?: Record<string, string>;
}

export function getModelOptions(
	modelId: string,
	options?: { reasoningEffort?: "low" | "medium" | "high" },
): ModelOptions {
	const anthropicProviderOptions: Record<string, JSONValue> = {
		cacheControl: { type: "ephemeral" },
		sendReasoning: true,
		thinking: { type: "enabled", budgetTokens: 4096 },
	};
	if (options?.reasoningEffort) {
		anthropicProviderOptions.effort = options.reasoningEffort;
	}

	if (modelId === Models.AnthropicClaude46Opus) {
		return {
			model: anthropic("claude-opus-4-6"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions: {
				anthropic: anthropicProviderOptions,
			},
		};
	}

	if (modelId === Models.AnthropicClaude45Sonnet) {
		return {
			model: anthropic("claude-sonnet-4-5"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions: {
				anthropic: anthropicProviderOptions,
			},
		};
	}

	if (modelId === Models.AnthropicClaude45Haiku) {
		return {
			model: anthropic("claude-haiku-4-5"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions: {
				anthropic: anthropicProviderOptions,
			},
		};
	}

	if (modelId === Models.OpenAIGpt52) {
		return {
			model: openai("gpt-5.2"),
			providerOptions: {
				openai: {
					reasoningSummary: "detailed",
					...(options?.reasoningEffort
						? { reasoningEffort: options.reasoningEffort }
						: {}),
				},
			},
		};
	}

	if (modelId === Models.OpenAIGpt5Mini) {
		return {
			model: openai("gpt-5-mini"),
			providerOptions: {
				openai: {
					reasoningSummary: "detailed",
					...(options?.reasoningEffort
						? { reasoningEffort: options.reasoningEffort }
						: {}),
				},
			},
		};
	}

	if (modelId === Models.OpenAIGpt5Nano) {
		return {
			model: openai("gpt-5-nano"),
			providerOptions: {
				openai: {
					reasoningSummary: "detailed",
					...(options?.reasoningEffort
						? { reasoningEffort: options.reasoningEffort }
						: {}),
				},
			},
		};
	}

	throw new Error(`Unsupported model: ${modelId}`);
}
