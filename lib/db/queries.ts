import "server-only";

import { desc, eq } from "drizzle-orm";
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
		console.error("Failed to get projects list:", error);
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
		console.error("Failed to get project by id:", error);
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
		console.error("Failed to create project:", error);
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
		console.error("Failed to update project:", error);
		throw new Error("Failed to update project");
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
		console.error("Failed to delete project:", error);
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
		console.error("Failed to get messages by project id:", error);
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
		console.error("Failed to create message:", error);
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
		console.error("Failed to delete messages by project id:", error);
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
		console.error("Failed to save messages:", error);
		throw new Error("Failed to save messages");
	}
}
