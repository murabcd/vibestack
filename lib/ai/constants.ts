export enum Models {
	AnthropicClaude45Sonnet = "anthropic/claude-sonnet-4.5",
	AnthropicClaude4Sonnet = "anthropic/claude-4-sonnet",
	AnthropicClaude45Haiku = "anthropic/claude-haiku-4-5",
	OpenAIGpt52 = "openai/gpt-5.2",
}

export const DEFAULT_MODEL = Models.OpenAIGpt52;

export const SUPPORTED_MODELS: string[] = [
	Models.AnthropicClaude45Sonnet,
	Models.AnthropicClaude4Sonnet,
	Models.AnthropicClaude45Haiku,
	Models.OpenAIGpt52,
];

export const TEST_PROMPTS = [
	"Generate a Next.js app that allows to list and search Pokemons",
	'Create a `golang` server that responds with "Hello World" to any request',
];
