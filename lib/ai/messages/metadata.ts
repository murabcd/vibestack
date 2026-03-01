import z from "zod/v3";
import type { AppUsage } from "@/lib/ai/usage";

export const metadataSchema = z.object({
	model: z.string(),
	usage: z.any().optional(),
	stepStats: z
		.object({
			count: z.number(),
			totalDurationMs: z.number(),
			avgDurationMs: z.number(),
			totalOutputTokens: z.number(),
		})
		.optional(),
});

export type Metadata = z.infer<typeof metadataSchema> & {
	usage?: AppUsage;
};
