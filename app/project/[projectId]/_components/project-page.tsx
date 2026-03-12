"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSandboxStore } from "@/app/state";
import { useSession } from "@/components/auth/session-provider";
import { ProjectChat } from "@/components/chat/project-chat";
import type { ChatUIMessage } from "@/components/chat/types";
import { EnhancedPreview } from "@/components/enhanced-preview/enhanced-preview";
import { Horizontal } from "@/components/layout/panels";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarToggle } from "@/components/sidebar/sidebar-toggle";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import type { AppUsage } from "@/lib/ai/usage";
import { cn } from "@/lib/utils";
import { CommitGitHubButton } from "./commit-github-button";
import { ShareVisibilityButton } from "./share-visibility-button";

interface ProjectPageClientProps {
	projectId: string;
	initialMessages: ChatUIMessage[];
	initialModelId?: string;
}

interface ProjectDetails {
	title?: string | null;
	visibility: "public" | "private";
	userId?: string;
	lastContext?: AppUsage | null;
}

function hasPendingProjectCookie(projectId: string) {
	if (typeof window === "undefined") return false;

	const hasPendingMessage =
		window.sessionStorage.getItem(`pending-message-${projectId}`) !== null;
	if (hasPendingMessage) {
		return true;
	}

	return document.cookie
		.split("; ")
		.some((cookie) => cookie === `pending_project_id=${projectId}`);
}

export function ProjectPageClient({
	projectId,
	initialMessages,
	initialModelId,
}: ProjectPageClientProps) {
	const { isMobile } = useSidebar();
	const { session } = useSession();
	const hasPreviewContent = useSandboxStore(
		(state) =>
			Boolean(state.url) ||
			Boolean(state.sandboxId) ||
			state.paths.length > 0 ||
			state.commands.length > 0,
	);
	const [activePanel, setActivePanel] = useState<"chat" | "preview">("chat");
	const [hasOpenedPreview, setHasOpenedPreview] = useState(false);
	const previewPanelNonce = useSandboxStore((state) => state.previewPanelNonce);
	const isPendingProjectBootstrap = useMemo(
		() => hasPendingProjectCookie(projectId),
		[projectId],
	);
	const { data: projectData, error: projectError } = useSWR<{
		project?: ProjectDetails;
	}>(`/api/projects/${projectId}`, {
		refreshInterval: (latestData) =>
			latestData?.project
				? latestData.project.title?.trim()
					? 0
					: 1500
				: isPendingProjectBootstrap
					? 400
					: 0,
		shouldRetryOnError: (error) =>
			isPendingProjectBootstrap &&
			error instanceof Error &&
			error.message.includes("404"),
		errorRetryInterval: 400,
		errorRetryCount: isPendingProjectBootstrap ? 12 : 0,
	});
	const project = projectData?.project;
	const displayProjectTitle = project?.title?.trim() || "";
	const initialVisibility = project?.visibility ?? "private";
	const canManageProject =
		project?.userId !== undefined && project.userId === session?.user?.id;
	const initialLastContext = project?.lastContext ?? undefined;
	const notFound =
		!isPendingProjectBootstrap &&
		projectError instanceof Error &&
		projectError.message.includes("404");
	// Global ref to prevent BOTH mobile and desktop ProjectChat from sending the same message
	const hasSentPendingMessage = useRef(false);
	const pendingMessage = useMemo<PromptInputMessage | null>(() => {
		if (typeof window === "undefined" || initialMessages.length > 0) {
			return null;
		}
		try {
			const storedMessage = sessionStorage.getItem(
				`pending-message-${projectId}`,
			);
			return storedMessage
				? (JSON.parse(storedMessage) as PromptInputMessage)
				: null;
		} catch (error) {
			console.error("Failed to parse pending message:", error);
			return null;
		}
	}, [projectId, initialMessages.length]);

	useEffect(() => {
		if (previewPanelNonce === 0) return;
		setHasOpenedPreview(true);
		setActivePanel("preview");
	}, [previewPanelNonce]);

	useEffect(() => {
		if (!isMobile || !hasPreviewContent) return;
		setHasOpenedPreview(true);
	}, [hasPreviewContent, isMobile]);

	if (notFound) {
		return (
			<>
				<AppSidebar />
				<SidebarInset>
					<div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
						<h1 className="text-xl font-semibold">Project not found</h1>
						<p className="max-w-md text-sm text-muted-foreground">
							This project may be private, deleted, or still being created.
						</p>
						<Link
							href="/"
							className="text-sm font-medium text-primary underline-offset-4 hover:underline"
						>
							Go back home
						</Link>
					</div>
				</SidebarInset>
			</>
		);
	}

	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
					<div className="flex items-center w-full gap-2">
						<SidebarToggle />
						<nav aria-label="Project breadcrumb">
							<ol className="flex items-center gap-1.5 text-sm">
								<li className="text-muted-foreground">Projects</li>
								{displayProjectTitle ? (
									<>
										<li aria-hidden="true" className="text-muted-foreground/70">
											<ChevronRight className="size-3.5" />
										</li>
										<li className="truncate max-w-[120px] sm:max-w-[320px] text-foreground">
											{displayProjectTitle}
										</li>
									</>
								) : null}
							</ol>
						</nav>
						<div className="flex items-center flex-1" />
						{canManageProject ? (
							<>
								<ShareVisibilityButton
									projectId={projectId}
									initialVisibility={initialVisibility}
								/>
								<CommitGitHubButton
									projectId={projectId}
									projectTitle={project?.title}
								/>
							</>
						) : null}
					</div>
					{isMobile ? (
						<>
							<ul className="flex space-x-5 text-sm tracking-tight px-1 py-2">
								<li>
									<button
										type="button"
										onClick={() => setActivePanel("chat")}
										className={cn("cursor-pointer", {
											"border-b border-b-black": activePanel === "chat",
										})}
									>
										Chat
									</button>
								</li>
								<li>
									<button
										type="button"
										onClick={() => {
											setHasOpenedPreview(true);
											setActivePanel("preview");
										}}
										className={cn("cursor-pointer", {
											"border-b border-b-black": activePanel === "preview",
										})}
									>
										Preview
									</button>
								</li>
							</ul>
							<div className="flex flex-1 w-full overflow-hidden pt-2">
								<div
									className={cn("flex-1 min-h-0", {
										hidden: activePanel !== "chat",
										flex: activePanel === "chat",
									})}
								>
									<ProjectChat
										className="flex-1 overflow-hidden"
										initialMessages={initialMessages}
										projectId={projectId}
										pendingMessage={pendingMessage}
										sentMessageRef={hasSentPendingMessage}
										initialLastContext={initialLastContext}
										initialModelId={initialModelId}
									/>
								</div>
								{hasOpenedPreview ? (
									<div
										className={cn("flex-1 min-h-0", {
											hidden: activePanel !== "preview",
											flex: activePanel === "preview",
										})}
									>
										<EnhancedPreview className="flex-1 overflow-hidden" />
									</div>
								) : null}
							</div>
						</>
					) : (
						<div className="flex flex-1 w-full min-h-0 overflow-hidden pt-2">
							<Horizontal
								defaultLayout={[30, 70]}
								left={
									<ProjectChat
										className="flex-1 overflow-hidden"
										initialMessages={initialMessages}
										projectId={projectId}
										pendingMessage={pendingMessage}
										sentMessageRef={hasSentPendingMessage}
										initialLastContext={initialLastContext}
										initialModelId={initialModelId}
									/>
								}
								right={<EnhancedPreview className="flex-1 overflow-hidden" />}
							/>
						</div>
					)}
				</div>
			</SidebarInset>
		</>
	);
}
