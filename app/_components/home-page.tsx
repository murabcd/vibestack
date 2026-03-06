"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { generateTitleFromUserMessage } from "@/app/actions";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarToggle } from "@/components/sidebar/sidebar-toggle";
import type { PromptInputMessage } from "@/components/ui/prompt-input";
import { SidebarInset } from "@/components/ui/sidebar";
import { useAppHaptics } from "@/hooks/use-app-haptics";
import { generateUUID } from "@/lib/utils";
import { InitialScreen } from "../initial-screen";

interface ProjectListItem {
	id: string;
	projectId: string;
	title: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	visibility: "public" | "private";
	userId?: string;
	isPinned?: boolean;
	status?: "idle" | "processing" | "completed" | "error";
	progress?: number;
	sandboxId?: string;
	sandboxUrl?: string;
	previewUrl?: string;
}

function getTemporaryProjectTitle(message: PromptInputMessage) {
	const text = message.text?.trim();
	if (!text) {
		return "New Project";
	}

	return text.slice(0, 60);
}

export function PageClient({
	initialSandboxDuration,
	initialModelId,
}: {
	initialSandboxDuration: number;
	initialModelId?: string;
}) {
	const router = useRouter();
	const { mutate } = useSWRConfig();
	const [isCreatingProject, setIsCreatingProject] = useState(false);
	const { selection, error: errorHaptic, success } = useAppHaptics();

	const setPendingProjectCookie = (projectId?: string) => {
		if (typeof window === "undefined" || !window.cookieStore) return;
		if (projectId) {
			void window.cookieStore.set({
				name: "pending_project_id",
				value: projectId,
				path: "/",
				expires: Date.now() + 120_000,
			});
			return;
		}
		void window.cookieStore.delete({
			name: "pending_project_id",
			path: "/",
		});
	};

	const handleMessageSubmit = async (message: PromptInputMessage) => {
		if (isCreatingProject) return;

		selection();
		setIsCreatingProject(true);

		try {
			// Generate project ID
			const projectId = nanoid();
			const now = new Date().toISOString();
			const temporaryTitle = getTemporaryProjectTitle(message);
			const optimisticProject: ProjectListItem = {
				id: projectId,
				projectId,
				title: temporaryTitle,
				createdAt: now,
				updatedAt: now,
				visibility: "private",
				isPinned: false,
				status: "idle",
				progress: 0,
			};

			// Store message in sessionStorage to be picked up by project page
			sessionStorage.setItem(
				`pending-message-${projectId}`,
				JSON.stringify({
					text: message.text,
					files: message.files,
				}),
			);
			setPendingProjectCookie(projectId);
			void mutate<{ projects: ProjectListItem[] }>(
				"/api/projects",
				(current) => {
					if (!current) {
						return { projects: [optimisticProject] };
					}

					const hasProject = current.projects.some(
						(project) => project.projectId === projectId,
					);
					if (hasProject) {
						return current;
					}

					return {
						...current,
						projects: [optimisticProject, ...current.projects],
					};
				},
				{
					revalidate: false,
				},
			);

			const initializeProjectPromise = fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId,
					title: " ", // Placeholder title - invisible to user
					visibility: "private",
				}),
			})
				.then(async (response) => {
					if (!response.ok) {
						throw new Error("Failed to create project");
					}
					await response.json();
					setPendingProjectCookie();

					// Generate title in background after project exists.
					const title = await generateTitleFromUserMessage({
						message: {
							id: generateUUID(),
							role: "user",
							parts: message.files
								? [{ type: "text", text: message.text || "" }, ...message.files]
								: [{ type: "text", text: message.text || "" }],
						},
					});

					await fetch(`/api/projects/${projectId}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ title }),
					});
					void mutate<{ projects: ProjectListItem[] }>(
						"/api/projects",
						(current) => {
							if (!current) {
								return current;
							}

							return {
								...current,
								projects: current.projects.map((project) =>
									project.projectId === projectId
										? {
												...project,
												title,
												updatedAt: new Date().toISOString(),
											}
										: project,
								),
							};
						},
						{
							revalidate: false,
						},
					);
				})
				.catch((caughtError) => {
					void mutate<{ projects: ProjectListItem[] }>(
						"/api/projects",
						(current) => {
							if (!current) {
								return current;
							}

							return {
								...current,
								projects: current.projects.filter(
									(project) => project.projectId !== projectId,
								),
							};
						},
						{
							revalidate: false,
						},
					);
					setPendingProjectCookie();
					console.error("Failed to initialize project:", caughtError);
					toast.error("Failed to initialize project. Please try again.");
					errorHaptic();
				});

			// Navigate to project page immediately (no waiting!)
			router.push(`/project/${projectId}`);
			success();
			void initializeProjectPromise;
		} catch (caughtError) {
			setPendingProjectCookie();
			console.error("Failed to create project:", caughtError);
			toast.error("Failed to create project. Please try again.");
			errorHaptic();
			setIsCreatingProject(false);
		}
	};

	// Root page always shows the clean initial screen
	return (
		<>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-col h-screen max-h-screen overflow-hidden p-2 space-x-2">
					<div className="flex items-center w-full gap-2">
						<SidebarToggle />
						<div className="flex items-center flex-1" />
					</div>
					<InitialScreen
						onMessageSubmit={handleMessageSubmit}
						isLoading={isCreatingProject}
						initialSandboxDuration={initialSandboxDuration}
						initialModelId={initialModelId}
					/>
				</div>
			</SidebarInset>
		</>
	);
}
