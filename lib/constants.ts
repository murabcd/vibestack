// Vercel Sandbox API limit: 45 minutes (2,700,000 ms)
export const MAX_ALLOWED_SANDBOX_DURATION = 45;
const MIN_ALLOWED_SANDBOX_DURATION = 10;
const DEFAULT_SANDBOX_DURATION = 30;

const rawSandboxDuration = parseInt(
	process.env.MAX_SANDBOX_DURATION || `${DEFAULT_SANDBOX_DURATION}`,
	10,
);

// Sandbox configuration (in minutes), clamped to API-supported bounds.
export const MAX_SANDBOX_DURATION = Number.isNaN(rawSandboxDuration)
	? DEFAULT_SANDBOX_DURATION
	: Math.min(
			MAX_ALLOWED_SANDBOX_DURATION,
			Math.max(MIN_ALLOWED_SANDBOX_DURATION, rawSandboxDuration),
		);
