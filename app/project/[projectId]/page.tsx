import type { Metadata } from "next";
import type { ChatUIMessage } from "@/components/chat/types";
import { getMessagesByProjectId, getProjectById } from "@/lib/db/queries";
import { getSessionFromCookie } from "@/lib/session/server";
import { convertToUIMessages } from "@/lib/utils";
import { ProjectPageClient } from "./_components/project-page";

interface ProjectPageProps {
	params: Promise<{
		projectId: string;
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

export default async function ProjectPage({ params }: ProjectPageProps) {
	const { projectId } = await params;
	let initialMessages: ChatUIMessage[] = [];

	try {
		const [session, project] = await Promise.all([
			getSessionFromCookie(),
			getProjectById(projectId),
		]);
		const isOwner = project?.userId === session?.user?.id;
		const canReadMessages =
			Boolean(project) && (project?.visibility === "public" || isOwner);

		if (canReadMessages) {
			const storedMessages = await getMessagesByProjectId(projectId);
			initialMessages = await convertToUIMessages(storedMessages);
		}
	} catch {
		initialMessages = [];
	}

	return (
		<ProjectPageClient
			projectId={projectId}
			initialMessages={initialMessages}
		/>
	);
}
