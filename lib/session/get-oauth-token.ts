import "server-only";

import { and, eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/index";
import { accounts, users } from "@/lib/db/schema";
import { logger } from "@/lib/logging/logger";

type OAuthProvider = "github" | "vercel";

function decodeToken(value: string | null | undefined) {
	if (!value) return null;
	try {
		// Legacy rows may store plain OAuth tokens. Prefer decrypt, fall back to raw.
		return decrypt(value);
	} catch {
		return value;
	}
}

/**
 * Get the OAuth access token for a user from the database
 * Returns the decrypted token or null if not found
 *
 * For GitHub: Checks accounts table first (connected account), then users table (primary account)
 * For Vercel: Gets from users table (primary account only)
 */
export async function getOAuthToken(
	userId: string,
	provider: OAuthProvider,
): Promise<{
	accessToken: string;
	refreshToken: string | null;
	expiresAt: Date | null;
} | null> {
	try {
		if (provider === "github") {
			// Check if user has GitHub as a connected account
			const account = await db
				.select({
					accessToken: accounts.accessToken,
					refreshToken: accounts.refreshToken,
					expiresAt: accounts.expiresAt,
				})
				.from(accounts)
				.where(
					and(eq(accounts.userId, userId), eq(accounts.provider, "github")),
				)
				.limit(1);

			if (account[0]?.accessToken) {
				return {
					accessToken: decodeToken(account[0].accessToken) ?? "",
					refreshToken: decodeToken(account[0].refreshToken),
					expiresAt: account[0].expiresAt,
				};
			}

			// Fall back to checking if user signed in with GitHub (primary account)
			const user = await db
				.select({
					accessToken: users.accessToken,
					refreshToken: users.refreshToken,
				})
				.from(users)
				.where(and(eq(users.id, userId), eq(users.provider, "github")))
				.limit(1);

			if (user[0]?.accessToken) {
				return {
					accessToken: decodeToken(user[0].accessToken) ?? "",
					refreshToken: decodeToken(user[0].refreshToken),
					expiresAt: null, // Users table doesn't have expiresAt
				};
			}
		} else if (provider === "vercel") {
			// Vercel is only available as a primary account
			const user = await db
				.select({
					accessToken: users.accessToken,
					refreshToken: users.refreshToken,
				})
				.from(users)
				.where(and(eq(users.id, userId), eq(users.provider, "vercel")))
				.limit(1);

			if (user[0]?.accessToken) {
				return {
					accessToken: decodeToken(user[0].accessToken) ?? "",
					refreshToken: decodeToken(user[0].refreshToken),
					expiresAt: null, // Users table doesn't have expiresAt
				};
			}
		}

		return null;
	} catch (error) {
		logger.error({
			event: "oauth.token.fetch_failed",
			user_id: userId,
			provider,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
