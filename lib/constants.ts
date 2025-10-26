// Sandbox configuration (in minutes)
export const MAX_SANDBOX_DURATION = parseInt(
	process.env.MAX_SANDBOX_DURATION || "60",
	10,
);

// Maximum allowed sandbox duration (5 hours)
export const MAX_ALLOWED_SANDBOX_DURATION = 300;

