"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { generateTitleFromUserMessage } from "@/app/actions";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarToggle } from "@/components/sidebar/sidebar-toggle";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { SidebarInset } from "@/components/ui/sidebar";
import { generateUUID } from "@/lib/utils";
import { InitialScreen } from "./initial-screen";

export function PageClient() {
	const router = useRouter();
	const [isCreatingProject, setIsCreatingProject] = useState(false);

	const handleMessageSubmit = async (message: PromptInputMessage) => {
		if (isCreatingProject) return;

		setIsCreatingProject(true);

		try {
			// Generate project ID
			const projectId = nanoid();

			// Create project with placeholder title for instant navigation
			const response = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId,
					title: " ", // Placeholder title - invisible to user
					visibility: "private",
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to create project");
			}

			await response.json();

			// Store message in sessionStorage to be picked up by project page
			sessionStorage.setItem(
				`pending-message-${projectId}`,
				JSON.stringify({
					text: message.text,
					files: message.files,
				}),
			);

			// Navigate to project page immediately (no waiting!)
			router.push(`/project/${projectId}`);

			// Generate title in background using setTimeout to ensure it's truly async
			setTimeout(() => {
				generateTitleFromUserMessage({
					message: {
						id: generateUUID(),
						role: "user",
						parts: message.files
							? [{ type: "text", text: message.text || "" }, ...message.files]
							: [{ type: "text", text: message.text || "" }],
					},
				})
					.then(async (title) => {
						// Update project title in background
						try {
							await fetch(`/api/projects/${projectId}`, {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ title }),
							});
						} catch (error) {
							console.error("Failed to update project title:", error);
						}
					})
					.catch((error) => {
						console.error("Failed to generate title:", error);
					});
			}, 0);
		} catch (error) {
			console.error("Failed to create project:", error);
			toast.error("Failed to create project. Please try again.");
			setIsCreatingProject(false);
		}
	};

	const handleNewProject = () => {
		router.push("/");
		router.refresh();
	};

	// Root page always shows the clean initial screen
	return (
		<>
			<AppSidebar onNewProject={handleNewProject} />
			<SidebarInset>
				<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
					<div className="flex items-center w-full gap-2">
						<SidebarToggle />
						<div className="flex items-center flex-1" />
					</div>
					<InitialScreen
						onMessageSubmit={handleMessageSubmit}
						isLoading={isCreatingProject}
					/>
				</div>
			</SidebarInset>
		</>
	);
}
