import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

const githubClientId = env.GITHUB_CLIENT_ID ?? env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
if (!githubClientId || !env.GITHUB_CLIENT_SECRET) {
	throw new Error(
		"GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required for Better Auth GitHub provider.",
	);
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
		schema,
	}),
	socialProviders: {
		github: {
			clientId: githubClientId,
			clientSecret: env.GITHUB_CLIENT_SECRET,
		},
	},
	account: {
		fields: {
			providerId: "provider",
			accountId: "externalUserId",
		},
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5,
		},
	},
	user: {
		fields: {
			image: "avatarUrl",
		},
	},
	plugins: [nextCookies()],
	advanced: {
		useSecureCookies: env.NODE_ENV === "production",
	},
});
