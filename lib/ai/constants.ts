export enum Models {
	AnthropicClaude45Sonnet = "anthropic/claude-sonnet-4.5",
	AnthropicClaude46Opus = "anthropic/claude-opus-4.6",
	AnthropicClaude45Haiku = "anthropic/claude-haiku-4-5",
	OpenAIGpt52 = "openai/gpt-5.2",
	OpenAIGpt5Mini = "openai/gpt-5-mini",
	OpenAIGpt5Nano = "openai/gpt-5-nano",
}

export const DEFAULT_MODEL = Models.OpenAIGpt52;

export const SUPPORTED_MODELS: string[] = [
	Models.AnthropicClaude45Sonnet,
	Models.AnthropicClaude46Opus,
	Models.AnthropicClaude45Haiku,
	Models.OpenAIGpt52,
	Models.OpenAIGpt5Mini,
	Models.OpenAIGpt5Nano,
];

export const TEST_PROMPTS = [
	"Generate a Next.js app that allows to list and search Pokemons",
	'Create a `golang` server that responds with "Hello World" to any request',
];
