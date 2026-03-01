// Vercel Sandbox API limit: 45 minutes (2,700,000 ms)
export const MAX_ALLOWED_SANDBOX_DURATION = 45;
const MIN_ALLOWED_SANDBOX_DURATION = 10;
const DEFAULT_SANDBOX_DURATION = 30;

// This module is imported by client code, so only read public env vars in the browser.
const sandboxDurationFromEnv =
	typeof window === "undefined"
		? (process.env.MAX_SANDBOX_DURATION ??
			process.env.NEXT_PUBLIC_MAX_SANDBOX_DURATION)
		: process.env.NEXT_PUBLIC_MAX_SANDBOX_DURATION;

const parsedSandboxDuration = sandboxDurationFromEnv
	? Number.parseInt(sandboxDurationFromEnv, 10)
	: DEFAULT_SANDBOX_DURATION;

// Sandbox configuration (in minutes), clamped to API-supported bounds.
export const MAX_SANDBOX_DURATION = Number.isNaN(parsedSandboxDuration)
	? DEFAULT_SANDBOX_DURATION
	: Math.min(
			MAX_ALLOWED_SANDBOX_DURATION,
			Math.max(MIN_ALLOWED_SANDBOX_DURATION, parsedSandboxDuration),
		);
