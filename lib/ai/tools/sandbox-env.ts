import { env } from "@/lib/env";

interface SandboxCredentials {
	projectId: string;
	teamId: string;
	token: string;
}

export function getSandboxCredentials(): SandboxCredentials {
	const teamId = env.SANDBOX_VERCEL_TEAM_ID;
	const projectId = env.SANDBOX_VERCEL_PROJECT_ID;
	const token = env.SANDBOX_VERCEL_TOKEN;

	if (!teamId || !projectId || !token) {
		throw new Error(
			"Missing required sandbox credentials. Set SANDBOX_VERCEL_TEAM_ID, SANDBOX_VERCEL_PROJECT_ID, and SANDBOX_VERCEL_TOKEN.",
		);
	}

	return { teamId, projectId, token };
}
