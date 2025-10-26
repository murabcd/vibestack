import type { Project } from "@/lib/db/schema";

export interface ToolContext {
	projectId: string;
	userId: string;
	sandboxDuration?: number; // Add this field
	updateProject: (updates: Partial<Project>) => Promise<void>;
}
