import z from "zod/v3";
import type { LanguageModelUsage } from "ai";

export const metadataSchema = z.object({
	model: z.string(),
	usage: z.any().optional(),
});

export type Metadata = z.infer<typeof metadataSchema> & {
	usage?: LanguageModelUsage;
};
