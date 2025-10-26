import "server-only";

import type { Session, Tokens } from "./types";
import { SESSION_COOKIE_NAME } from "./constants";
import { encryptJWE } from "@/lib/jwe/encrypt";
import { upsertUser } from "@/lib/db/users";
import { encrypt } from "@/lib/crypto";
import { cookies } from "next/headers";
import ms from "ms";

export async function createSession(
	tokens: Tokens,
	provider: "github" | "vercel",
	userData?: {
		externalId: string;
		username: string;
		email?: string;
		name?: string;
		avatarUrl?: string;
		scope?: string;
	},
): Promise<Session | undefined> {
	// If userData is provided, use it; otherwise create a basic session
	const userId = await upsertUser({
		provider,
		externalId: userData?.externalId || "temp-id",
		accessToken: encrypt(tokens.accessToken),
		refreshToken: tokens.refreshToken
			? encrypt(tokens.refreshToken)
			: undefined,
		scope: userData?.scope,
		username: userData?.username || "temp-user",
		email: userData?.email,
		name: userData?.name,
		avatarUrl: userData?.avatarUrl,
	});

	const session = {
		created: Date.now(),
		authProvider: provider,
		user: {
			id: userId,
			username: userData?.username || "temp-user",
			email: userData?.email,
			name: userData?.name,
			avatar: userData?.avatarUrl,
		},
	};

	console.log("Created session with internal user ID:", session.user.id);
	return session;
}

const COOKIE_TTL = ms("1y");

export async function saveSession(
	session: Session | undefined,
): Promise<string | undefined> {
	const cookieStore = await cookies();

	if (!session) {
		cookieStore.delete(SESSION_COOKIE_NAME);
		return;
	}

	const value = await encryptJWE(session, "1y");
	const expires = new Date(Date.now() + COOKIE_TTL);

	cookieStore.set(SESSION_COOKIE_NAME, value, {
		path: "/",
		expires,
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
	});

	return value;
}
