import "server-only";

import { db } from "./index";
import { users, accounts } from "./schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface UpsertUserData {
	provider: "github" | "vercel";
	externalId: string;
	accessToken: string;
	refreshToken?: string;
	scope?: string;
	username: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
}

export async function upsertUser(data: UpsertUserData): Promise<string> {
	// Check if user already exists
	const existingUser = await db
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				eq(users.provider, data.provider),
				eq(users.externalId, data.externalId),
			),
		)
		.limit(1);

	if (existingUser[0]) {
		// Update existing user
		await db
			.update(users)
			.set({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				scope: data.scope,
				username: data.username,
				email: data.email,
				name: data.name,
				avatarUrl: data.avatarUrl,
				updatedAt: new Date(),
				lastLoginAt: new Date(),
			})
			.where(eq(users.id, existingUser[0].id));

		return existingUser[0].id;
	}

	// Create new user
	const userId = nanoid();
	await db.insert(users).values({
		id: userId,
		provider: data.provider,
		externalId: data.externalId,
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
		scope: data.scope,
		username: data.username,
		email: data.email,
		name: data.name,
		avatarUrl: data.avatarUrl,
		createdAt: new Date(),
		updatedAt: new Date(),
		lastLoginAt: new Date(),
	});

	return userId;
}
