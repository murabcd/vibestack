"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProjectChat } from "@/components/chat/project-chat";
import type { ChatUIMessage } from "@/components/chat/types";
import { EnhancedPreview } from "@/components/enhanced-preview/enhanced-preview";
import { Horizontal } from "@/components/layout/panels";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarToggle } from "@/components/sidebar/sidebar-toggle";
import { TabContent, TabItem } from "@/components/tabs";
import { Button } from "@/components/ui/button";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { SidebarInset } from "@/components/ui/sidebar";
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
	const [isLoading, setIsLoading] = useState(true);
	const [pendingMessage, setPendingMessage] =
		useState<PromptInputMessage | null>(null);
	const hasCheckedStorage = useRef(false);
	// Global ref to prevent BOTH mobile and desktop ProjectChat from sending the same message
	const hasSentPendingMessage = useRef(false);

	// Check for pending first message in sessionStorage
	// Use ref to ensure this only runs ONCE, even in React StrictMode
	useEffect(() => {
		if (hasCheckedStorage.current) return;
		hasCheckedStorage.current = true;

		const messageKey = `pending-message-${projectId}`;
		const storedMessage = sessionStorage.getItem(messageKey);

		if (storedMessage && initialMessages.length === 0) {
			// Clear IMMEDIATELY before parsing to prevent double-read
			sessionStorage.removeItem(messageKey);

			try {
				const parsedMessage = JSON.parse(storedMessage);
				setPendingMessage(parsedMessage);
			} catch (error) {
				console.error("Failed to parse pending message:", error);
			}
		}

		setIsLoading(false);
	}, [projectId, initialMessages.length]);

	const handleNewProject = () => {
		router.push("/");
	};

	if (isLoading) {
		return (
			<>
				<AppSidebar />
				<SidebarInset>
					<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
						<div className="flex items-center w-full gap-2">
							<SidebarToggle />
							<div className="flex items-center flex-1" />
						</div>
						<div className="flex-1 flex items-center justify-center">
							<div className="text-center">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
								<p className="mt-2 text-gray-600">Loading project...</p>
							</div>
						</div>
					</div>
				</SidebarInset>
			</>
		);
	}

	// Show the split view for the project
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
					<ul className="flex space-x-5 text-sm tracking-tight px-1 py-2 md:hidden">
						<TabItem tabId="chat">Chat</TabItem>
						<TabItem tabId="preview">Preview</TabItem>
					</ul>

					<div className="flex flex-1 w-full overflow-hidden pt-2 md:hidden">
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

					<div className="hidden flex-1 w-full min-h-0 overflow-hidden pt-2 md:flex">
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
				</div>
			</SidebarInset>
		</>
	);
}
