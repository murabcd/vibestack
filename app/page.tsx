import { cookies } from "next/headers";
import { PageClient } from "@/app/page-client";
import { getMaxSandboxDuration } from "@/lib/db/settings";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";
import { getSessionFromCookie } from "@/lib/session/server";

export default async function Page() {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
	const session = await getSessionFromCookie(sessionCookie);
	let initialSandboxDuration = 60; // Default value

	if (session?.user?.id) {
		try {
			initialSandboxDuration = await getMaxSandboxDuration(session.user.id);
		} catch (error) {
			console.error("Failed to fetch sandbox duration:", error);
			// Use default value on error
		}
	}

	return <PageClient initialSandboxDuration={initialSandboxDuration} />;
}
