import "server-only";

import { and, desc, eq, notInArray } from "drizzle-orm";
import type { ChatUIMessage } from "@/components/chat/types";
import type { AppUsage } from "@/lib/ai/usage";
import type { ProjectGitHubMetadata } from "@/lib/github/project-metadata";
import { logger } from "@/lib/logging/logger";
import { db } from "./index";
import { messages, type Project, projectRuns, projects } from "./schema";

export async function getProjectsList(userId?: string): Promise<Project[]> {
	try {
		const query = db
			.select()
			.from(projects)
			.orderBy(desc(projects.isPinned), desc(projects.createdAt));

		if (userId) {
			return await query.where(eq(projects.userId, userId));
		}

		return await query;
	} catch (error) {
		logger.error({
			event: "db.projects.list_failed",
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to get projects list");
	}
}

export async function getProjectById(
	projectId: string,
): Promise<Project | null> {
	try {
		const [result] = await db
			.select()
			.from(projects)
			.where(eq(projects.projectId, projectId));
		return result || null;
	} catch (error) {
		logger.error({
			event: "db.projects.get_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function getProjectBySandboxId(
	sandboxId: string,
): Promise<Project | null> {
	try {
		const [result] = await db
			.select()
			.from(projects)
			.where(eq(projects.sandboxId, sandboxId));
		return result || null;
	} catch (error) {
		logger.error({
			event: "db.projects.get_by_sandbox_failed",
			sandbox_id: sandboxId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function createProject({
	projectId,
	title,
	visibility = "private",
	userId,
}: {
	projectId: string;
	title: string;
	visibility?: "public" | "private";
	userId: string;
}): Promise<Project> {
	try {
		const [result] = await db
			.insert(projects)
			.values({
				projectId,
				title,
				createdAt: new Date(),
				visibility,
				isPinned: false,
				status: "idle",
				progress: 0,
				userId,
			})
			.returning();
		return result;
	} catch (error) {
		logger.error({
			event: "db.projects.create_failed",
			project_id: projectId,
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to create project");
	}
}

export async function updateProject(
	projectId: string,
	updates: {
		title?: string;
		isPinned?: boolean;
		visibility?: "public" | "private";
		sandboxId?: string | null;
		sandboxUrl?: string | null;
		previewUrl?: string | null;
		status?: "idle" | "processing" | "completed" | "error";
		progress?: number;
		lastContext?: AppUsage | null;
		githubMetadata?: ProjectGitHubMetadata | null;
	},
): Promise<Project | null> {
	try {
		const [result] = await db
			.update(projects)
			.set(updates)
			.where(eq(projects.projectId, projectId))
			.returning();
		return result || null;
	} catch (error) {
		logger.error({
			event: "db.projects.update_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to update project");
	}
}

export async function updateProjectLastContext(
	projectId: string,
	lastContext: AppUsage,
): Promise<void> {
	try {
		await db
			.update(projects)
			.set({ lastContext })
			.where(eq(projects.projectId, projectId));
	} catch (error) {
		logger.error({
			event: "db.projects.update_last_context_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		// Don't throw error - this is not critical for the main flow
	}
}

export async function deleteProject(projectId: string): Promise<boolean> {
	try {
		const result = await db
			.delete(projects)
			.where(eq(projects.projectId, projectId))
			.returning();
		return result.length > 0;
	} catch (error) {
		logger.error({
			event: "db.projects.delete_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to delete project");
	}
}

// Message queries
export async function getMessagesByProjectId(projectId: string) {
	try {
		const result = await db
			.select()
			.from(messages)
			.where(eq(messages.projectId, projectId))
			.orderBy(messages.createdAt);
		return result;
	} catch (error) {
		logger.error({
			event: "db.messages.list_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		// Return empty array instead of throwing to allow graceful degradation
		return [];
	}
}

export async function deleteMessagesByProjectId(
	projectId: string,
): Promise<boolean> {
	try {
		const result = await db
			.delete(messages)
			.where(eq(messages.projectId, projectId))
			.returning();
		return result.length > 0;
	} catch (error) {
		logger.error({
			event: "db.messages.delete_by_project_failed",
			project_id: projectId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to delete messages by project id");
	}
}

export async function replaceProjectMessages({
	projectId,
	uiMessages,
}: {
	projectId: string;
	uiMessages: ChatUIMessage[];
}) {
	try {
		await db.delete(messages).where(eq(messages.projectId, projectId));

		if (uiMessages.length === 0) {
			return [];
		}

		const persistedMessages = uiMessages
			.filter(
				(message): message is ChatUIMessage & { role: "user" | "assistant" } =>
					message.role === "user" || message.role === "assistant",
			)
			.map((message) => ({
				projectId,
				role: message.role,
				content: message,
				createdAt: new Date(),
			}));

		if (persistedMessages.length === 0) {
			return [];
		}

		return await db.insert(messages).values(persistedMessages).returning();
	} catch (error) {
		logger.error({
			event: "db.messages.replace_failed",
			project_id: projectId,
			message_count: uiMessages.length,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to replace project messages");
	}
}

export async function createProjectRun({
	runId,
	projectId,
	userId,
	status = "queued",
}: {
	runId: string;
	projectId: string;
	userId: string;
	status?: "queued" | "processing" | "completed" | "error";
}) {
	try {
		const [result] = await db
			.insert(projectRuns)
			.values({
				runId,
				projectId,
				userId,
				status,
				summary: null,
				error: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();
		void pruneProjectRuns(projectId, userId);
		return result ?? null;
	} catch (error) {
		const dbError = error as {
			message?: string;
			cause?: { message?: string; code?: string; detail?: string } | undefined;
		};
		logger.error({
			event: "db.project_runs.create_failed",
			run_id: runId,
			project_id: projectId,
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
			error_cause: dbError?.cause?.message,
			error_code: dbError?.cause?.code,
			error_detail: dbError?.cause?.detail,
		});
		throw new Error("Failed to create project run");
	}
}

async function pruneProjectRuns(projectId: string, userId: string) {
	try {
		const keepLatest = 30;
		const rows = await db
			.select({ runId: projectRuns.runId })
			.from(projectRuns)
			.where(
				and(
					eq(projectRuns.projectId, projectId),
					eq(projectRuns.userId, userId),
				),
			)
			.orderBy(desc(projectRuns.createdAt));

		if (rows.length <= keepLatest) {
			return;
		}

		const keepIds = rows.slice(0, keepLatest).map((row) => row.runId);
		await db
			.delete(projectRuns)
			.where(
				and(
					eq(projectRuns.projectId, projectId),
					eq(projectRuns.userId, userId),
					notInArray(projectRuns.runId, keepIds),
				),
			);
	} catch (error) {
		logger.error({
			event: "db.project_runs.prune_failed",
			project_id: projectId,
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export async function updateProjectRun(
	runId: string,
	updates: {
		status?: "queued" | "processing" | "completed" | "error";
		summary?: string | null;
		error?: string | null;
	},
) {
	try {
		const [result] = await db
			.update(projectRuns)
			.set({
				...updates,
				updatedAt: new Date(),
			})
			.where(eq(projectRuns.runId, runId))
			.returning();
		return result ?? null;
	} catch (error) {
		logger.error({
			event: "db.project_runs.update_failed",
			run_id: runId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to update project run");
	}
}

export async function getLatestProjectRun({
	projectId,
	userId,
}: {
	projectId: string;
	userId: string;
}) {
	try {
		const [result] = await db
			.select()
			.from(projectRuns)
			.where(
				and(
					eq(projectRuns.projectId, projectId),
					eq(projectRuns.userId, userId),
				),
			)
			.orderBy(desc(projectRuns.createdAt))
			.limit(1);
		return result ?? null;
	} catch (error) {
		logger.error({
			event: "db.project_runs.get_latest_failed",
			project_id: projectId,
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
