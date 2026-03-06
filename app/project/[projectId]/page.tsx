import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getHorizontal } from "@/components/layout/sizing";
import type { AppUsage } from "@/lib/ai/usage";
import { MAX_SANDBOX_DURATION } from "@/lib/constants";
import { getProjectById } from "@/lib/db/queries";
import { getSessionFromCookie } from "@/lib/session/server";
import { ProjectPageClient } from "./_components/project-page";

const getProjectCached = cache(getProjectById);

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
	const cookieStore = await cookies();
	const horizontalSizes = getHorizontal(cookieStore);
	const session = await getSessionFromCookie();

	const { projectId } = await params;
	const project = await getProjectCached(projectId);
	const pendingProjectId = cookieStore.get("pending_project_id")?.value;
	const isPendingProjectBootstrap =
		!project && pendingProjectId && pendingProjectId === projectId;

	if (!project && !isPendingProjectBootstrap) {
		notFound();
	}
	if (
		project &&
		project.visibility !== "public" &&
		project.userId !== session?.user?.id
	) {
		notFound();
	}
	const isOwner = project ? project.userId === session?.user?.id : true;
	const initialLastContext: AppUsage | undefined =
		project?.lastContext ?? undefined;

	const modelIdFromCookie = cookieStore.get("selected-model")?.value;
	const sandboxDurationFromCookie = cookieStore.get("sandbox-duration")?.value;
	const initialSandboxDuration = sandboxDurationFromCookie
		? parseInt(sandboxDurationFromCookie, 10)
		: MAX_SANDBOX_DURATION;

	return (
		<ProjectPageClient
			horizontalSizes={horizontalSizes ?? []}
			projectId={projectId}
			projectTitle={project?.title}
			initialVisibility={project?.visibility ?? "private"}
			isOwner={isOwner}
			initialMessages={[]}
			initialSandboxDuration={initialSandboxDuration}
			initialLastContext={initialLastContext}
			initialModelId={modelIdFromCookie}
		/>
	);
}
