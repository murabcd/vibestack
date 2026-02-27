import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { JSONValue, LanguageModel } from "ai";
import { Models } from "./constants";

const anthropic = createAnthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});
const openai = createOpenAI({
	apiKey: process.env.OPENAI_API_KEY,
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
	options?: { reasoningEffort?: "minimal" | "low" | "medium" },
): ModelOptions {
	if (modelId === Models.AnthropicClaude46Opus) {
		return {
			model: anthropic("claude-opus-4-6"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions: {
				anthropic: {
					cacheControl: { type: "ephemeral" },
				},
			},
		};
	}

	if (modelId === Models.AnthropicClaude45Sonnet) {
		return {
			model: anthropic("claude-sonnet-4-5"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions: {
				anthropic: {
					cacheControl: { type: "ephemeral" },
				},
			},
		};
	}

	if (modelId === Models.AnthropicClaude45Haiku) {
		const providerOptions: Record<string, Record<string, JSONValue>> = {
			anthropic: {
				cacheControl: { type: "ephemeral" },
			},
		};

		if (options?.reasoningEffort) {
			providerOptions.anthropic.reasoning = { effort: options.reasoningEffort };
		}

		return {
			model: anthropic("claude-haiku-4-5"),
			headers: { "anthropic-beta": "fine-grained-tool-streaming-2025-05-14" },
			providerOptions,
		};
	}

	if (modelId === Models.OpenAIGpt52) {
		return {
			model: openai("gpt-5.2"),
		};
	}

	if (modelId === Models.OpenAIGpt5Mini) {
		return {
			model: openai("gpt-5-mini"),
		};
	}

	if (modelId === Models.OpenAIGpt5Nano) {
		return {
			model: openai("gpt-5-nano"),
		};
	}

	throw new Error(`Unsupported model: ${modelId}`);
}
