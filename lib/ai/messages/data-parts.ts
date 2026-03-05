import z from "zod/v3";

export const dataPartSchema = z.object({
	"task-coding-v1": z.object({
		taskNameActive: z.string().optional(),
		taskNameComplete: z.string().optional(),
		status: z.enum(["loading", "done", "error"]),
		parts: z.array(z.record(z.string(), z.unknown())),
	}),
	"report-errors": z.object({
		summary: z.string(),
		paths: z.array(z.string()).optional(),
	}),
});

export type DataPart = z.infer<typeof dataPartSchema>;
