import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "@/lib/ai/usage";

// Users table - user profile and primary OAuth account
export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(), // Internal user ID (we generate this)
		// Primary OAuth account info (how they signed in)
		provider: text("provider", {
			enum: ["github", "vercel"],
		}).notNull(), // Primary auth provider
		externalId: text("external_id").notNull(), // External ID from OAuth provider
		accessToken: text("access_token").notNull(), // Encrypted OAuth access token
		refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
		scope: text("scope"), // OAuth scope
		// Profile info
		username: text("username").notNull(),
		email: text("email"),
		name: text("name"),
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

// Accounts table - Additional accounts linked to users
// Currently only GitHub can be connected as an additional account
// (e.g., Vercel users can connect their GitHub account)
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
		accessToken: text("access_token").notNull(), // Encrypted OAuth access token
		refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
		expiresAt: timestamp("expires_at"),
		scope: text("scope"),
		username: text("username").notNull(), // GitHub username
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		// Unique constraint: a user can only have one account per provider
		userIdProviderUnique: uniqueIndex("accounts_user_id_provider_idx").on(
			table.userId,
			table.provider,
		),
	}),
);

export type Account = InferSelectModel<typeof accounts>;

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
});

export type Project = InferSelectModel<typeof projects>;

export const messages = pgTable("messages", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	projectId: text("projectId").notNull(),
	role: varchar("role", { enum: ["user", "assistant"] }).notNull(),
	content: jsonb("content").notNull(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Settings table - key-value pairs for user-specific settings
export const settings = pgTable(
	"settings",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }), // Foreign key to users table
		key: text("key").notNull(), // Setting key (e.g., 'maxSandboxDuration')
		value: text("value").notNull(), // Setting value (stored as text)
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		// Unique constraint: prevent duplicate keys per user
		userIdKeyUnique: uniqueIndex("settings_user_id_key_idx").on(
			table.userId,
			table.key,
		),
	}),
);

export type Setting = InferSelectModel<typeof settings>;
