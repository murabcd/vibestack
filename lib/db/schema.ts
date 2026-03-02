import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { AppUsage } from "@/lib/ai/usage";
import type { ProjectGitHubMetadata } from "@/lib/github/project-metadata";

// Users table - application users + Better Auth user model
export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(), // Internal user ID (we generate this)
		// Legacy auth metadata kept for compatibility
		provider: text("provider", {
			enum: ["github", "vercel"],
		})
			.notNull()
			.default("github"), // Primary auth provider
		externalId: text("external_id").notNull().default(""), // External ID from OAuth provider
		accessToken: text("access_token").notNull().default(""), // Encrypted OAuth access token
		refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
		scope: text("scope"), // OAuth scope
		// Profile info
		username: text("username").notNull().default(""),
		email: text("email"),
		name: text("name"),
		emailVerified: boolean("email_verified").notNull().default(false),
		avatarUrl: text("avatar_url"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		lastLoginAt: timestamp("last_login_at").defaultNow().notNull(),
	},
	(table) => ({
		// Unique constraint: prevent duplicate signups from same provider + external ID
		providerExternalIdUnique: uniqueIndex("users_provider_external_id_idx").on(
			table.provider,
			table.externalId,
		),
	}),
);

export type User = InferSelectModel<typeof users>;

// Accounts table - Better Auth account model with legacy fields retained
export const accounts = pgTable(
	"accounts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // Foreign key to users table
		provider: text("provider", {
			enum: ["github"],
		})
			.notNull()
			.default("github"), // Only GitHub for now
		externalUserId: text("external_user_id").notNull(), // GitHub user ID
		accessToken: text("access_token"), // Encrypted OAuth access token
		refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
		idToken: text("id_token"),
		expiresAt: timestamp("expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		username: text("username").notNull().default(""), // GitHub username
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		userProviderUnique: uniqueIndex(
			"accounts_provider_external_user_id_idx",
		).on(table.provider, table.externalUserId),
	}),
);

export type Account = InferSelectModel<typeof accounts>;

export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		tokenUnique: uniqueIndex("sessions_token_idx").on(table.token),
		userIdIdx: index("sessions_user_id_idx").on(table.userId),
	}),
);

export const verifications = pgTable(
	"verifications",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		identifierValueUnique: uniqueIndex("verifications_identifier_value_idx").on(
			table.identifier,
			table.value,
		),
	}),
);

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	projectId: text("projectId").notNull().unique(),
	title: text("title").notNull(),
	createdAt: timestamp("createdAt").notNull(),
	visibility: varchar("visibility", { enum: ["public", "private"] })
		.notNull()
		.default("private"),
	isPinned: boolean("isPinned").notNull().default(false),
	// User association
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }), // Foreign key to users table
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
	lastContext: jsonb("lastContext").$type<AppUsage | null>(),
	// MCP server IDs
	mcpServerIds: jsonb("mcpServerIds").$type<string[] | null>(),
	// GitHub source/sync/PR metadata
	githubMetadata: jsonb("githubMetadata").$type<ProjectGitHubMetadata | null>(),
});

export type Project = InferSelectModel<typeof projects>;

export const messages = pgTable(
	"messages",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		projectId: text("projectId")
			.notNull()
			.references(() => projects.projectId, { onDelete: "cascade" }),
		role: varchar("role", { enum: ["user", "assistant"] }).notNull(),
		content: jsonb("content").notNull(),
		createdAt: timestamp("createdAt").notNull().defaultNow(),
	},
	(table) => ({
		projectIdIdx: index("messages_project_id_idx").on(table.projectId),
	}),
);

export const projectRuns = pgTable(
	"project_runs",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		runId: text("run_id").notNull().unique(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.projectId, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		status: varchar("status", {
			enum: ["queued", "processing", "completed", "error"],
		})
			.notNull()
			.default("queued"),
		summary: text("summary"),
		error: text("error"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		projectIdCreatedAtIdx: index("project_runs_project_id_created_at_idx").on(
			table.projectId,
			table.createdAt,
		),
		userIdCreatedAtIdx: index("project_runs_user_id_created_at_idx").on(
			table.userId,
			table.createdAt,
		),
	}),
);

// Connectors table - MCP server connectors
export const connectors = pgTable("connectors", {
	id: text("id").primaryKey().notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	type: varchar("type", { enum: ["local", "remote"] })
		.notNull()
		.default("remote"),
	baseUrl: text("base_url"),
	oauthClientId: text("oauth_client_id"),
	oauthClientSecret: text("oauth_client_secret"), // Encrypted
	command: text("command"),
	env: text("env"), // Encrypted JSON string
	status: varchar("status", { enum: ["connected", "disconnected"] })
		.notNull()
		.default("disconnected"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Connector = InferSelectModel<typeof connectors>;

// Zod schemas for validation
export const insertConnectorSchema = createInsertSchema(connectors, {
	id: z.string().optional(),
	userId: z.string(),
	name: z.string().min(1),
	description: z.string().optional(),
	type: z.enum(["local", "remote"]),
	baseUrl: z
		.string()
		.url()
		.optional()
		.or(z.literal("").transform(() => undefined)),
	oauthClientId: z
		.string()
		.optional()
		.or(z.literal("").transform(() => undefined)),
	oauthClientSecret: z
		.string()
		.optional()
		.or(z.literal("").transform(() => undefined)),
	command: z
		.string()
		.optional()
		.or(z.literal("").transform(() => undefined)),
	env: z.record(z.string(), z.string()).optional(),
	status: z.enum(["connected", "disconnected"]),
	createdAt: z.date().optional(),
	updatedAt: z.date().optional(),
})
	.omit({
		createdAt: true,
		updatedAt: true,
	})
	.refine(
		(data) => {
			if (data.type === "remote") {
				return !!data.baseUrl;
			}
			return true;
		},
		{
			message: "Base URL is required for remote servers",
			path: ["baseUrl"],
		},
	)
	.refine(
		(data) => {
			if (data.type === "local") {
				return !!data.command;
			}
			return true;
		},
		{
			message: "Command is required for local servers",
			path: ["command"],
		},
	);

export const selectConnectorSchema = createSelectSchema(connectors);
