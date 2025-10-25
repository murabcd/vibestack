import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	projectId: text("projectId").notNull().unique(),
	title: text("title").notNull(),
	createdAt: timestamp("createdAt").notNull(),
	visibility: varchar("visibility", { enum: ["public", "private"] })
		.notNull()
		.default("private"),
	isPinned: boolean("isPinned").notNull().default(false),
	// Sandbox tracking fields
	sandboxId: text("sandboxId"),
	sandboxUrl: text("sandboxUrl"),
	previewUrl: text("previewUrl"),
	status: varchar("status", {
		enum: ["idle", "processing", "completed", "error"],
	})
		.notNull()
		.default("idle"),
	progress: integer("progress").notNull().default(0),
});

export type Project = InferSelectModel<typeof projects>;

export const messages = pgTable("messages", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	projectId: text("projectId").notNull(),
	role: varchar("role", { enum: ["user", "assistant"] }).notNull(),
	content: jsonb("content").notNull(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});
