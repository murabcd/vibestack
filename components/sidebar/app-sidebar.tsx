"use client";

import { Plus, TextSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarHistory } from "@/components/sidebar/sidebar-history";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export const AppSidebar = ({
	onNewProject,
}: {
	onNewProject?: () => void;
} = {}) => {
	const router = useRouter();
	const { setOpenMobile } = useSidebar();
	const [openCommandDialog, setOpenCommandDialog] = useState(false);

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

	const handleNewProject = () => {
		setOpenMobile(false);
		if (onNewProject) {
			onNewProject();
		} else {
			router.push("/");
			router.refresh();
		}
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
								{/* TBD: Projects list? */}
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
										onClick={handleNewProject}
									>
										<Plus />
									</Button>
								</TooltipTrigger>
								<TooltipContent align="end">New project</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarHistory
					openCommandDialog={openCommandDialog}
					setOpenCommandDialog={setOpenCommandDialog}
					onSelectProject={handleSelectProject}
				/>
			</SidebarContent>
			<SidebarFooter>
				<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
					{/* TBD: Login auth will be there */}
				</div>
			</SidebarFooter>
		</Sidebar>
	);
};
