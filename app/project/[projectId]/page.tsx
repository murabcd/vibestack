import { cookies } from "next/headers";
import type { ChatUIMessage } from "@/components/chat/types";
import { getHorizontal } from "@/components/layout/sizing";
import { getMessagesByProjectId } from "@/lib/db/queries";
import { getMaxSandboxDuration } from "@/lib/db/settings";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";
import { getSessionFromCookie } from "@/lib/session/server";
import { convertToUIMessages } from "@/lib/utils";
import { ProjectPageClient } from "./page-client";

interface ProjectPageProps {
	params: Promise<{
		projectId: string;
	}>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
	const store = await cookies();
	const horizontalSizes = getHorizontal(store);

	// Await the params Promise
	const { projectId } = await params;

	// Fetch messages from database with error handling
	let initialMessages: ChatUIMessage[] = [];
	try {
		const messagesFromDb = await getMessagesByProjectId(projectId);
		initialMessages = convertToUIMessages(messagesFromDb);
	} catch (error) {
		console.error("Failed to fetch messages:", error);
		// Continue with empty messages array - this allows the page to load
		// even if the database query fails
	}

	// Fetch user's sandbox duration setting
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

	return (
		<ProjectPageClient
			horizontalSizes={horizontalSizes ?? []}
			projectId={projectId}
			initialMessages={initialMessages}
			initialSandboxDuration={initialSandboxDuration}
		/>
	);
}
