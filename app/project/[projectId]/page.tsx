import type { Metadata } from "next";
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

	return <ProjectPageClient projectId={projectId} initialMessages={[]} />;
}
