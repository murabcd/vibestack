import { cookies } from "next/headers";
import type { ChatUIMessage } from "@/components/chat/types";
import { getHorizontal } from "@/components/layout/sizing";
import type { AppUsage } from "@/lib/ai/usage";
import { MAX_SANDBOX_DURATION } from "@/lib/constants";
import { getMessagesByProjectId, getProjectById } from "@/lib/db/queries";
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
	let initialLastContext: AppUsage | undefined;
	try {
		const messagesFromDb = await getMessagesByProjectId(projectId);
		initialMessages = convertToUIMessages(messagesFromDb);

		// Fetch project data to get lastContext
		const project = await getProjectById(projectId);
		initialLastContext = project?.lastContext ?? undefined;
	} catch (error) {
		console.error("Failed to fetch messages or project:", error);
		// Continue with empty messages array - this allows the page to load
		// even if the database query fails
	}

	// Get settings from cookies
	const cookieStore = await cookies();
	const modelIdFromCookie = cookieStore.get("selected-model")?.value;
	const sandboxDurationFromCookie = cookieStore.get("sandbox-duration")?.value;
	const initialSandboxDuration = sandboxDurationFromCookie
		? parseInt(sandboxDurationFromCookie, 10)
		: MAX_SANDBOX_DURATION;

	return (
		<ProjectPageClient
			horizontalSizes={horizontalSizes ?? []}
			projectId={projectId}
			initialMessages={initialMessages}
			initialSandboxDuration={initialSandboxDuration}
			initialLastContext={initialLastContext}
			initialModelId={modelIdFromCookie}
		/>
	);
}
