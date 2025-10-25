"use client";

import { Chat } from "./chat";
import { InitialScreen } from "./initial-screen";
import { Horizontal } from "@/components/layout/panels";
import { EnhancedPreview } from "@/components/enhanced-preview/enhanced-preview";
import { TabContent, TabItem } from "@/components/tabs";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useChat } from "@ai-sdk/react";
import { useSharedChatContext } from "@/lib/chat-context";
import { useSettings } from "@/components/settings/use-settings";
import type { ChatUIMessage } from "@/components/chat/types";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { useState } from "react";

interface PageClientProps {
	horizontalSizes: number[] | null;
}

export function PageClient({ horizontalSizes }: PageClientProps) {
	const { chat } = useSharedChatContext();
	const { messages, sendMessage } = useChat<ChatUIMessage>({ chat });
	const { modelId, reasoningEffort } = useSettings();
	const [hasStartedConversation, setHasStartedConversation] = useState(
		messages.length > 0,
	);

	const handleMessageSubmit = (message: PromptInputMessage) => {
		sendMessage(
			{
				...message,
				text: message.text || "",
			},
			{
				body: {
					modelId,
					reasoningEffort,
				},
			},
		);
		setHasStartedConversation(true);
	};

	// If no conversation has started, show the initial screen
	if (!hasStartedConversation) {
		return (
			<>
				<AppSidebar />
				<SidebarInset>
					<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
						<div className="flex items-center w-full gap-2">
							<SidebarToggle />
							<div className="flex items-center flex-1" />
						</div>
						<InitialScreen onMessageSubmit={handleMessageSubmit} />
					</div>
				</SidebarInset>
			</>
		);
	}

	// If conversation has started, show the split view
	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
					<div className="flex items-center w-full">
						<SidebarToggle />
					</div>
					<ul className="flex space-x-5 text-sm tracking-tight px-1 py-2 md:hidden">
						<TabItem tabId="chat">Chat</TabItem>
						<TabItem tabId="preview">Preview</TabItem>
					</ul>

					<div className="flex flex-1 w-full overflow-hidden pt-2 md:hidden">
						<TabContent tabId="chat" className="flex-1">
							<Chat className="flex-1 overflow-hidden" />
						</TabContent>
						<TabContent tabId="preview" className="flex-1">
							<EnhancedPreview className="flex-1 overflow-hidden" />
						</TabContent>
					</div>

					<div className="hidden flex-1 w-full min-h-0 overflow-hidden pt-2 md:flex">
						<Horizontal
							defaultLayout={horizontalSizes ?? [30, 70]}
							left={<Chat className="flex-1 overflow-hidden" />}
							right={<EnhancedPreview className="flex-1 overflow-hidden" />}
						/>
					</div>
				</div>
			</SidebarInset>
		</>
	);
}
