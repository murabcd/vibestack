"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
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
	horizontalSizes: number[] | null;
	projectId: string;
	projectTitle?: string | null;
	initialVisibility: "public" | "private";
	isOwner: boolean;
	initialMessages: ChatUIMessage[];
	initialSandboxDuration: number;
	initialLastContext?: AppUsage;
	initialModelId?: string;
}

export function ProjectPageClient({
	horizontalSizes,
	projectId,
	projectTitle,
	initialVisibility,
	isOwner,
	initialMessages,
	initialSandboxDuration,
	initialLastContext,
	initialModelId,
}: ProjectPageClientProps) {
	const { isMobile } = useSidebar();
	const [activePanel, setActivePanel] = useState<"chat" | "preview">("chat");
	const [hasOpenedPreview, setHasOpenedPreview] = useState(false);
	const { data: projectData } = useSWR<{ project?: { title?: string | null } }>(
		`/api/projects/${projectId}`,
		{
			refreshInterval: (latestData) =>
				latestData?.project?.title?.trim() ? 0 : 1500,
		},
	);
	const displayProjectTitle =
		projectData?.project?.title?.trim() || projectTitle?.trim() || "";
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
						{isOwner ? (
							<>
								<ShareVisibilityButton
									projectId={projectId}
									initialVisibility={initialVisibility}
								/>
								<CommitGitHubButton
									projectId={projectId}
									projectTitle={projectTitle}
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
										initialSandboxDuration={initialSandboxDuration}
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
								defaultLayout={horizontalSizes ?? [30, 70]}
								left={
									<ProjectChat
										className="flex-1 overflow-hidden"
										initialMessages={initialMessages}
										projectId={projectId}
										pendingMessage={pendingMessage}
										sentMessageRef={hasSentPendingMessage}
										initialSandboxDuration={initialSandboxDuration}
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
