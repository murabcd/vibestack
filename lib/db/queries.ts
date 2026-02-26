import "server-only";

import { desc, eq } from "drizzle-orm";
import type { AppUsage } from "@/lib/ai/usage";
import { logger } from "@/lib/logging/logger";
import { db } from "./index";
import { messages, type Project, projects } from "./schema";

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
		throw new Error("Failed to get project by id");
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

export async function createMessage({
	projectId,
	role,
	content,
}: {
	projectId: string;
	role: "user" | "assistant";
	content: unknown; // JSONB content with message parts
}) {
	try {
		const [result] = await db
			.insert(messages)
			.values({
				projectId,
				role,
				content,
				createdAt: new Date(),
			})
			.returning();
		return result;
	} catch (error) {
		logger.error({
			event: "db.messages.create_failed",
			project_id: projectId,
			role,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to create message");
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

export async function saveMessages({
	messages: messagesToSave,
}: {
	messages: Array<{
		projectId: string;
		role: "user" | "assistant";
		content: unknown;
	}>;
}) {
	try {
		const result = await db.insert(messages).values(messagesToSave).returning();
		return result;
	} catch (error) {
		logger.error({
			event: "db.messages.bulk_save_failed",
			message_count: messagesToSave.length,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error("Failed to save messages");
	}
}
