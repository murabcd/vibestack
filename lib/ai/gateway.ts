import { createAnthropic } from "@ai-sdk/anthropic";
import { Models } from "./constants";
import type { JSONValue } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";

const anthropic = createAnthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

const AVAILABLE_MODELS = [
	{ id: Models.AnthropicClaude4Sonnet, name: "Claude 4 Sonnet" },
	{ id: Models.AnthropicClaude45Sonnet, name: "Claude 4.5 Sonnet" },
	{ id: Models.AnthropicClaude45Haiku, name: "Claude 4.5 Haiku" },
];

export async function getAvailableModels() {
	return AVAILABLE_MODELS;
}

export interface ModelOptions {
	model: LanguageModelV2;
	providerOptions?: Record<string, Record<string, JSONValue>>;
	headers?: Record<string, string>;
}

export function getModelOptions(
	modelId: string,
	options?: { reasoningEffort?: "minimal" | "low" | "medium" },
): ModelOptions {
	if (modelId === Models.AnthropicClaude4Sonnet) {
		return {
			model: anthropic("claude-sonnet-4-0"),
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
