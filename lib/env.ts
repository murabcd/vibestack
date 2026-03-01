import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.string().url(),
		ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		OPENAI_API_KEY: z.string().min(1),
		ANTHROPIC_API_KEY: z.string().min(1),
		SANDBOX_VERCEL_TOKEN: z.string().min(1),
		SANDBOX_VERCEL_TEAM_ID: z.string().min(1),
		SANDBOX_VERCEL_PROJECT_ID: z.string().min(1),
	},
	shared: {
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		VERCEL_REGION: z.string().optional(),
		VERCEL_GIT_COMMIT_SHA: z.string().optional(),
		NEXT_PUBLIC_GITHUB_CLIENT_ID: z.string().min(1).optional(),
	},
	experimental__runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		VERCEL_REGION: process.env.VERCEL_REGION,
		VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
		NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
	},
	skipValidation:
		process.env.SKIP_ENV_VALIDATION === "true" ||
		process.env.NODE_ENV === "test",
	onValidationError: (issues) => {
		console.error("Invalid environment variables:", issues);
		throw new Error("Invalid environment variables");
	},
	emptyStringAsUndefined: true,
});
