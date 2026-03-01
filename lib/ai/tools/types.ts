import type { Project } from "@/lib/db/schema";

export interface ToolContext {
	projectId?: string;
	userId?: string;
	sandboxDuration?: number;
	getActiveSandboxId?: () => string | null;
	setActiveSandboxId?: (sandboxId: string) => void;
	registerSingletonToolUse?: (toolName: string) => boolean;
	isDuplicateToolInput?: (toolName: string, input: unknown) => boolean;
	canUseTool?: (toolName: string) => boolean;
	recordToolOutcome?: (
		toolName: string,
		outcome: "success" | "failure",
	) => void;
	updateProject: (updates: Partial<Project>) => Promise<void>;
}
