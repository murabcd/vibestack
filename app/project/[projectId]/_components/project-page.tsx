"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { ProjectChat } from "@/components/chat/project-chat";
import type { ChatUIMessage } from "@/components/chat/types";
import { EnhancedPreview } from "@/components/enhanced-preview/enhanced-preview";
import { Horizontal } from "@/components/layout/panels";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarToggle } from "@/components/sidebar/sidebar-toggle";
import { TabContent } from "@/components/tabs/tab-content";
import { TabItem } from "@/components/tabs/tab-item";
import { Button } from "@/components/ui/button";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import type { AppUsage } from "@/lib/ai/usage";

interface ProjectPageClientProps {
	horizontalSizes: number[] | null;
	projectId: string;
	initialMessages: ChatUIMessage[];
	initialSandboxDuration: number;
	initialLastContext?: AppUsage;
	initialModelId?: string;
}

export function ProjectPageClient({
	horizontalSizes,
	projectId,
	initialMessages,
	initialSandboxDuration,
	initialLastContext,
	initialModelId,
}: ProjectPageClientProps) {
	const router = useRouter();
	const { isMobile } = useSidebar();
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

	const handleNewProject = () => {
		router.push("/");
	};

	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
					<div className="flex items-center w-full gap-2">
						<SidebarToggle />
						<div className="flex items-center flex-1" />
						<div className="md:hidden">
							<Button
								onClick={handleNewProject}
								variant="outline"
								className="px-2 h-fit"
							>
								<Plus className="w-4 h-4 mr-2" />
								New project
							</Button>
						</div>
					</div>
					{isMobile ? (
						<>
							<ul className="flex space-x-5 text-sm tracking-tight px-1 py-2">
								<TabItem tabId="chat">Chat</TabItem>
								<TabItem tabId="preview">Preview</TabItem>
							</ul>
							<div className="flex flex-1 w-full overflow-hidden pt-2">
								<TabContent tabId="chat" className="flex-1">
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
								</TabContent>
								<TabContent tabId="preview" className="flex-1">
									<EnhancedPreview className="flex-1 overflow-hidden" />
								</TabContent>
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
