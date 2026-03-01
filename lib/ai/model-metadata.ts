import { Models } from "@/lib/ai/constants";

export interface ModelPricing {
	inputPerMillion: number;
	outputPerMillion: number;
}

interface ModelMetadata {
	contextWindow: number;
	pricing: ModelPricing;
}

const MODEL_METADATA: Record<string, ModelMetadata> = {
	[Models.OpenAIGpt52]: {
		contextWindow: 400000,
		pricing: { inputPerMillion: 1.75, outputPerMillion: 14 },
	},
	[Models.OpenAIGpt5Mini]: {
		contextWindow: 400000,
		pricing: { inputPerMillion: 0.25, outputPerMillion: 2 },
	},
	[Models.OpenAIGpt5Nano]: {
		contextWindow: 400000,
		pricing: { inputPerMillion: 0.05, outputPerMillion: 0.4 },
	},
	[Models.AnthropicClaude46Opus]: {
		contextWindow: 1000000,
		pricing: { inputPerMillion: 5, outputPerMillion: 25 },
	},
	[Models.AnthropicClaude45Sonnet]: {
		contextWindow: 200000,
		pricing: { inputPerMillion: 3, outputPerMillion: 15 },
	},
	[Models.AnthropicClaude45Haiku]: {
		contextWindow: 200000,
		pricing: { inputPerMillion: 1, outputPerMillion: 5 },
	},
};

export function getModelMetadata(modelId?: string): ModelMetadata | undefined {
	if (!modelId) {
		return undefined;
	}
	return MODEL_METADATA[modelId];
}

export function getModelContextWindow(modelId?: string): number | undefined {
	return getModelMetadata(modelId)?.contextWindow;
}

export function getModelPricing(modelId?: string): ModelPricing | undefined {
	return getModelMetadata(modelId)?.pricing;
}
