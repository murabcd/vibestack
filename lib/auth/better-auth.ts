import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
		schema,
	}),
	socialProviders: {
		github: {
			clientId:
				process.env.GITHUB_CLIENT_ID ??
				process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ??
				"",
			clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
		},
	},
	account: {
		fields: {
			providerId: "provider",
			accountId: "externalUserId",
		},
	},
	user: {
		fields: {
			image: "avatarUrl",
		},
	},
	plugins: [nextCookies()],
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
	},
});
