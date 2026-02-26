import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cache } from "react";
import type { ChatUIMessage } from "@/components/chat/types";
import { getHorizontal } from "@/components/layout/sizing";
import type { AppUsage } from "@/lib/ai/usage";
import { MAX_SANDBOX_DURATION } from "@/lib/constants";
import { getMessagesByProjectId, getProjectById } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";
import { ProjectPageClient } from "./_components/project-page";

const getProjectCached = cache(getProjectById);

interface ProjectPageProps {
	params: Promise<{
		projectId: string;
	}>;
	searchParams: Promise<{
		new?: string;
	}>;
}

export async function generateMetadata({
	params: _params,
}: ProjectPageProps): Promise<Metadata> {
	const title = "Project";

	return {
		title,
		description: `View and manage your ${title} project on VibeStack.`,
		openGraph: {
			title,
			description: `View and manage your ${title} project on VibeStack.`,
		},
		twitter: {
			card: "summary_large_image",
			title,
			description: `View and manage your ${title} project on VibeStack.`,
		},
	};
}

export default async function ProjectPage({
	params,
	searchParams: _searchParams,
}: ProjectPageProps) {
	const cookieStore = await cookies();
	const horizontalSizes = getHorizontal(cookieStore);

	const [{ projectId }] = await Promise.all([params, _searchParams]);

	// Fetch messages from database with error handling
	let initialMessages: ChatUIMessage[] = [];
	let initialLastContext: AppUsage | undefined;
	try {
			const [messagesFromDb, project] = await Promise.all([
				getMessagesByProjectId(projectId),
				getProjectCached(projectId),
			]);
			initialMessages = await convertToUIMessages(messagesFromDb);
			initialLastContext = project?.lastContext ?? undefined;
		} catch (error) {
		console.error("Failed to fetch messages or project:", error);
		// Continue with empty messages array - this allows the page to load
		// even if the database query fails
	}

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
