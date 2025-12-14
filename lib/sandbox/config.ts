export function validateSandboxEnvironmentVariables() {
	const errors: string[] = [];

	if (!process.env.SANDBOX_VERCEL_TEAM_ID) {
		errors.push("SANDBOX_VERCEL_TEAM_ID is required for sandbox creation");
	}

	if (!process.env.SANDBOX_VERCEL_PROJECT_ID) {
		errors.push("SANDBOX_VERCEL_PROJECT_ID is required for sandbox creation");
	}

	if (!process.env.SANDBOX_VERCEL_TOKEN) {
		errors.push("SANDBOX_VERCEL_TOKEN is required for sandbox creation");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

export function getSandboxConfig() {
	const teamId = process.env.SANDBOX_VERCEL_TEAM_ID;
	const projectId = process.env.SANDBOX_VERCEL_PROJECT_ID;
	const token = process.env.SANDBOX_VERCEL_TOKEN;

	if (!teamId || !projectId || !token) {
		throw new Error(
			"Missing required sandbox environment variables: SANDBOX_VERCEL_TEAM_ID, SANDBOX_VERCEL_PROJECT_ID, or SANDBOX_VERCEL_TOKEN",
		);
	}

	return {
		teamId,
		projectId,
		token,
	};
}
