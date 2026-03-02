"use client";

import { Plus, TextSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "@/components/auth/session-provider";
import { SignIn } from "@/components/auth/sign-in";
import { ChatSearchCommand } from "@/components/sidebar/chat-search-command";
import { SidebarHistory } from "@/components/sidebar/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppHaptics } from "@/hooks/use-app-haptics";

interface Project {
	id: string;
	projectId: string;
	title: string;
	createdAt: Date;
	updatedAt: Date;
	visibility: "public" | "private";
	userId?: string;
}

export const AppSidebar = () => {
	const router = useRouter();
	const { isMobile, setOpenMobile } = useSidebar();
	const { selection } = useAppHaptics();
	const [openCommandDialog, setOpenCommandDialog] = useState(false);
	const { session } = useSession();
	const { data } = useSWR<{ projects: Project[] }>("/api/projects");
	const allProjects = data?.projects ?? [];

	const handleOpenCommandDialog = (open: boolean) => {
		if (open) {
			selection();
		}
		setOpenCommandDialog(open);
		if (open && isMobile) {
			setOpenMobile(false);
		}
	};

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpenCommandDialog((open) => {
					const next = !open;
					if (next && isMobile) {
						setOpenMobile(false);
					}
					return next;
				});
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [isMobile, setOpenMobile]);

	const handleSelectProject = (projectId: string) => {
		selection();
		router.push(`/project/${projectId}`);
		setOpenCommandDialog(false);
		setOpenMobile(false);
	};

	return (
		<>
			<Sidebar className="group-data-[side=left]:border-r-0">
				<SidebarHeader>
					<SidebarMenu>
						<div className="flex flex-col gap-2">
							<div className="flex flex-row justify-between items-center gap-1">
								<Link
									href="/"
									onClick={() => {
										selection();
										setOpenMobile(false);
									}}
									className="flex flex-row gap-3 items-center"
								>
									<span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
										Vibe<span className="text-muted-foreground">Stack</span>
									</span>
								</Link>
								<div className="flex flex-row items-center">
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												type="button"
												className="cursor-pointer"
												onClick={() => handleOpenCommandDialog(true)}
											>
												<TextSearch className="w-4 h-4" />
											</Button>
										</TooltipTrigger>
										{!isMobile ? (
											<TooltipContent align="end">
												Search projects (⌘K)
											</TooltipContent>
										) : null}
									</Tooltip>
									{!isMobile ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													type="button"
													className="cursor-pointer"
													onClick={() => {
														selection();
														setOpenMobile(false);
														router.push("/");
														router.refresh();
													}}
												>
													<Plus className="w-4 h-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent align="end">New project</TooltipContent>
										</Tooltip>
									) : null}
								</div>
							</div>
							{isMobile ? (
								<Button
									variant="outline"
									type="button"
									onClick={() => {
										selection();
										setOpenMobile(false);
										router.push("/");
										router.refresh();
									}}
								>
									<Plus className="w-4 h-4" />
									New project
								</Button>
							) : null}
						</div>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					{session ? (
						<SidebarHistory />
					) : (
						<SidebarGroup>
							<SidebarGroupContent>
								<div className="px-2 py-4 text-sm text-muted-foreground">
									Sign in to view your project history and revisit previous
									chats.
								</div>
							</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
				<SidebarFooter>
					{session ? <SidebarUserNav /> : <SignIn />}
				</SidebarFooter>
			</Sidebar>
			<ChatSearchCommand
				open={openCommandDialog}
				onOpenChange={handleOpenCommandDialog}
				history={allProjects.map((project) => ({
					...project,
					chatId: project.projectId,
				}))}
				onSelectChat={handleSelectProject}
			/>
		</>
	);
};
