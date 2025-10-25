import { cookies } from "next/headers";
import type { ChatUIMessage } from "@/components/chat/types";
import { getHorizontal } from "@/components/layout/sizing";
import { getMessagesByProjectId } from "@/lib/db/queries";
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

	return (
		<ProjectPageClient
			horizontalSizes={horizontalSizes ?? []}
			projectId={projectId}
			initialMessages={initialMessages}
		/>
	);
}
