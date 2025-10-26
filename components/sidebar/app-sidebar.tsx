"use client";

import { TextSearch, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarHistory } from "@/components/sidebar/sidebar-history";
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
import { SignIn } from "@/components/auth/sign-in";
import { useSession } from "@/components/auth/session-provider";
import { SidebarUserNav } from "@/components/sidebar/sidebar-user-nav";

export const AppSidebar = () => {
	const router = useRouter();
	const { setOpenMobile } = useSidebar();
	const [openCommandDialog, setOpenCommandDialog] = useState(false);
	const { session } = useSession();

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpenCommandDialog((open) => !open);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	const handleSelectProject = (projectId: string) => {
		router.push(`/project/${projectId}`);
		setOpenCommandDialog(false);
		setOpenMobile(false);
	};

	return (
		<Sidebar className="group-data-[side=left]:border-r-0">
			<SidebarHeader>
				<SidebarMenu>
					<div className="flex flex-row justify-between items-center gap-1">
						<Link
							href="/"
							onClick={() => {
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
										type="button"
										className="p-2 h-fit"
										onClick={() => setOpenCommandDialog(true)}
									>
										<TextSearch className="w-4 h-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent align="end">
									Search projects (⌘K)
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										type="button"
										className="p-2 h-fit"
										onClick={() => {
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
						</div>
					</div>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{session ? (
					<SidebarHistory
						openCommandDialog={openCommandDialog}
						setOpenCommandDialog={setOpenCommandDialog}
						onSelectProject={handleSelectProject}
					/>
				) : (
					<SidebarGroup>
						<SidebarGroupContent>
							<div className="px-2 py-4 text-sm text-muted-foreground">
								Sign in to view your project history and revisit previous chats.
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter>{session ? <SidebarUserNav /> : <SignIn />}</SidebarFooter>
		</Sidebar>
	);
};
