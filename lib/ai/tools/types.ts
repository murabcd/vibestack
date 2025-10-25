import type { Project } from "@/lib/db/schema";

export interface ToolContext {
	projectId: string;
	updateProject: (updates: Partial<Project>) => Promise<void>;
}
