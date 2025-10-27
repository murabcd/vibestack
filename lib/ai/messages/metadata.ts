import z from "zod/v3";
import type { AppUsage } from "@/lib/ai/usage";

export const metadataSchema = z.object({
	model: z.string(),
	usage: z.any().optional(),
});

export type Metadata = z.infer<typeof metadataSchema> & {
	usage?: AppUsage;
};
