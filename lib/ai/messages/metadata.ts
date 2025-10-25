import type { LanguageModelUsage } from "ai";
import z from "zod/v3";

export const metadataSchema = z.object({
	model: z.string(),
	usage: z.any().optional(),
});

export type Metadata = z.infer<typeof metadataSchema> & {
	usage?: LanguageModelUsage;
};
