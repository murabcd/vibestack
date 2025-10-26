"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import {
	Check,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Share2,
	Trash,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { ChatSearchCommand } from "./chat-search-command";

// Simple type definition for projects
interface Project {
	id: string;
	projectId: string;
	title: string;
	createdAt: Date;
	updatedAt: Date;
	visibility: "public" | "private";
	userId?: string;
	isPinned?: boolean;
	status?: "idle" | "processing" | "completed" | "error";
	progress?: number;
	sandboxId?: string;
	sandboxUrl?: string;
	previewUrl?: string;
}

import useSWR from "swr";

type GroupedProjects = {
	today: Project[];
	yesterday: Project[];
	lastWeek: Project[];
	lastMonth: Project[];
	older: Project[];
};

const groupProjectsByDate = (projects: Project[]): GroupedProjects => {
	const now = new Date();
	const oneWeekAgo = subWeeks(now, 1);
	const oneMonthAgo = subMonths(now, 1);

	return projects.reduce(
		(groups, project) => {
			const projectDate = new Date(project.createdAt);

			if (isToday(projectDate)) {
				groups.today.push(project);
			} else if (isYesterday(projectDate)) {
				groups.yesterday.push(project);
			} else if (projectDate > oneWeekAgo) {
				groups.lastWeek.push(project);
			} else if (projectDate > oneMonthAgo) {
				groups.lastMonth.push(project);
			} else {
				groups.older.push(project);
			}

			return groups;
		},
		{
			today: [],
			yesterday: [],
			lastWeek: [],
			lastMonth: [],
			older: [],
		} as GroupedProjects,
	);
};

const PureProjectItem = ({
	project,
	isActive,
	onDelete,
	setOpenMobile,
	onUpdateProject,
}: {
	project: Project;
	isActive: boolean;
	onDelete: (projectId: string) => void;
	setOpenMobile: (open: boolean) => void;
	onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
}) => {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [isRenaming, setIsRenaming] = useState(false);
	const [editingTitle, setEditingTitle] = useState(project.title);
	const inputRef = useRef<HTMLInputElement>(null);

	const { visibilityType, setVisibilityType } = useChatVisibility({
		chatId: project.projectId,
		initialVisibility: project.visibility,
	});

	useEffect(() => {
		if (isRenaming) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming]);

	const handleRenameSubmit = () => {
		const newTitle = editingTitle.trim();
		setIsRenaming(false);

		if (newTitle && newTitle !== project.title) {
			onUpdateProject(project.projectId, { title: newTitle });
			toast.success("Project renamed");
		} else {
			setEditingTitle(project.title);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			handleRenameSubmit();
		} else if (event.key === "Escape") {
			setEditingTitle(project.title);
			setIsRenaming(false);
		}
	};

	const handleTogglePin = () => {
		onUpdateProject(project.projectId, { isPinned: !project.isPinned });
		toast.success(project.isPinned ? "Project unpinned" : "Project pinned");
	};

	return (
		<SidebarMenuItem className="mb-1">
			{isRenaming ? (
				<div className="flex items-center px-2 py-1.5 w-full">
					<Input
						ref={inputRef}
						value={editingTitle}
						onChange={(e) => setEditingTitle(e.target.value)}
						onBlur={handleRenameSubmit}
						onKeyDown={handleKeyDown}
						className="h-7 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-ring"
					/>
				</div>
			) : (
				<SidebarMenuButton asChild isActive={isActive}>
					<Link
						href={`/project/${project.projectId}`}
						onClick={() => setOpenMobile(false)}
						className="flex items-center justify-between"
					>
						<span className="truncate flex-1 mr-2">{project.title}</span>
					</Link>
				</SidebarMenuButton>
			)}

			{!isRenaming && (
				<DropdownMenu
					modal={true}
					open={dropdownOpen}
					onOpenChange={setDropdownOpen}
				>
					<DropdownMenuTrigger asChild>
						<SidebarMenuAction
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
							showOnHover={!isActive}
						>
							<MoreHorizontal className="w-4 h-4" />
							<span className="sr-only">More</span>
						</SidebarMenuAction>
					</DropdownMenuTrigger>

					<DropdownMenuContent side="bottom" align="end">
						<DropdownMenuItem
							className="cursor-pointer"
							onSelect={(e) => {
								e.preventDefault();
								handleTogglePin();
								setDropdownOpen(false);
							}}
						>
							{project.isPinned ? (
								<PinOff className="w-4 h-4 mr-2" />
							) : (
								<Pin className="w-4 h-4 mr-2" />
							)}
							<span>{project.isPinned ? "Unpin" : "Pin"}</span>
						</DropdownMenuItem>

						<DropdownMenuSub>
							<DropdownMenuSubTrigger className="cursor-pointer">
								<Share2 className="w-4 h-4 mr-2" />
								<span>Share</span>
							</DropdownMenuSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									<DropdownMenuItem
										className="cursor-pointer flex-row justify-between"
										onClick={() => {
											setVisibilityType("private");
											onUpdateProject(project.projectId, {
												visibility: "private",
											});
										}}
									>
										Private
										{visibilityType === "private" ? (
											<Check className="w-4 h-4" />
										) : null}
									</DropdownMenuItem>
									<DropdownMenuItem
										className="cursor-pointer flex-row justify-between"
										onClick={() => {
											setVisibilityType("public");
											onUpdateProject(project.projectId, {
												visibility: "public",
											});
											const url = `${window.location.origin}/project/${project.projectId}`;
											navigator.clipboard
												.writeText(url)
												.then(() => {
													toast("Link copied to clipboard");
												})
												.catch((err) => {
													console.error("Failed to copy link: ", err);
													toast.error("Failed to copy link");
												});
										}}
									>
										Public
										{visibilityType === "public" ? (
											<Check className="w-4 h-4" />
										) : null}
									</DropdownMenuItem>
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>

						<DropdownMenuItem
							className="cursor-pointer"
							onSelect={(event) => {
								event.preventDefault();
								setEditingTitle(project.title);
								setIsRenaming(true);
								setDropdownOpen(false);
							}}
						>
							<Pencil className="w-4 h-4 mr-2" />
							<span>Rename</span>
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						<DropdownMenuItem
							className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
							onSelect={(event) => {
								event.preventDefault();
								onDelete(project.projectId);
								setDropdownOpen(false);
							}}
						>
							<Trash className="w-4 h-4 mr-2 text-destructive dark:text-red-500" />
							<span>Delete</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</SidebarMenuItem>
	);
};

export const ProjectItem = memo(PureProjectItem, (prevProps, nextProps) => {
	if (prevProps.isActive !== nextProps.isActive) return false;
	if (prevProps.project.title !== nextProps.project.title) return false;
	if (prevProps.project.isPinned !== nextProps.project.isPinned) return false;
	return true;
});

interface SidebarHistoryProps {
	openCommandDialog: boolean;
	setOpenCommandDialog: (open: boolean) => void;
	onSelectProject: (projectId: string) => void;
}

export function SidebarHistory({
	openCommandDialog,
	setOpenCommandDialog,
	onSelectProject,
}: SidebarHistoryProps) {
	const { setOpenMobile } = useSidebar();
	const pathname = usePathname();
	const router = useRouter();

	const projectId = useMemo(() => {
		const prefix = "/project/";
		if (pathname.startsWith(prefix)) {
			return pathname.slice(prefix.length);
		}
		return null;
	}, [pathname]);

	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Fetch projects from API
	const { data, error, mutate } = useSWR<{ projects: Project[] }>(
		"/api/projects",
		async (url: string) => {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error("Failed to fetch projects");
			}
			return response.json();
		},
	);

	const projects = data?.projects || [];

	const handleDelete = async () => {
		if (!deleteId) return;

		try {
			const response = await fetch(`/api/projects/${deleteId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete project");
			}

			// Optimistically update the UI
			mutate((data) => {
				if (!data) return data;
				return {
					...data,
					projects: data.projects.filter(
						(project) => project.projectId !== deleteId,
					),
				};
			});

			setShowDeleteDialog(false);
			setDeleteId(null);

			if (deleteId === projectId) {
				router.push("/");
			}

			toast.success("Project deleted");
		} catch (error) {
			console.error("Failed to delete project:", error);
			toast.error("Failed to delete project");
		}
	};

	const handleUpdateProject = async (
		projectId: string,
		updates: Partial<Project>,
	) => {
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updates),
			});

			if (!response.ok) {
				throw new Error("Failed to update project");
			}

			// Optimistically update the UI
			mutate((data) => {
				if (!data) return data;
				return {
					...data,
					projects: data.projects.map((project) =>
						project.projectId === projectId
							? { ...project, ...updates }
							: project,
					),
				};
			});
		} catch (error) {
			console.error("Failed to update project:", error);
			toast.error("Failed to update project");
		}
	};

	const { allProjects, pinnedProjects, otherProjectsGrouped } = useMemo(() => {
		if (!projects)
			return {
				allProjects: [],
				pinnedProjects: [],
				otherProjectsGrouped: null,
			};

		const mappedProjects = [...projects];

		mappedProjects.sort((a, b) => {
			const pinnedA = a.isPinned ?? false;
			const pinnedB = b.isPinned ?? false;
			if (pinnedA !== pinnedB) {
				return pinnedA ? -1 : 1;
			}
			// Ensure createdAt is a Date object before calling getTime()
			const aDate = new Date(a.createdAt);
			const bDate = new Date(b.createdAt);
			return bDate.getTime() - aDate.getTime();
		});

		const pinned = mappedProjects.filter((project) => project.isPinned);
		const others = mappedProjects.filter((project) => !project.isPinned);

		return {
			allProjects: mappedProjects,
			pinnedProjects: pinned,
			otherProjectsGrouped: groupProjectsByDate(others),
		};
	}, [projects]);

	if (error) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 text-red-500 w-full flex flex-row justify-center items-center text-sm gap-2">
						Failed to load project history
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	if (!data) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
						Loading project history...
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	if (allProjects.length === 0) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
						Your projects will appear here once you start creating.
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	return (
		<>
			{pinnedProjects.length > 0 && (
				<SidebarGroup>
					<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
						Pinned
					</div>
					<SidebarGroupContent>
						<SidebarMenu>
							{pinnedProjects.map((project) => (
								<ProjectItem
									key={project.id}
									project={project}
									isActive={project.projectId === projectId}
									onDelete={(projectId) => {
										setDeleteId(projectId);
										setShowDeleteDialog(true);
									}}
									setOpenMobile={setOpenMobile}
									onUpdateProject={handleUpdateProject}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			)}

			{otherProjectsGrouped &&
				Object.values(otherProjectsGrouped).some(
					(group) => group.length > 0,
				) && (
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<div className="flex flex-col gap-6">
									{otherProjectsGrouped.today.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Today
											</div>
											{otherProjectsGrouped.today.map((project) => (
												<ProjectItem
													key={project.id}
													project={project}
													isActive={project.projectId === projectId}
													onDelete={(projectId) => {
														setDeleteId(projectId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateProject={handleUpdateProject}
												/>
											))}
										</div>
									)}

									{otherProjectsGrouped.yesterday.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Yesterday
											</div>
											{otherProjectsGrouped.yesterday.map((project) => (
												<ProjectItem
													key={project.id}
													project={project}
													isActive={project.projectId === projectId}
													onDelete={(projectId) => {
														setDeleteId(projectId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateProject={handleUpdateProject}
												/>
											))}
										</div>
									)}

									{otherProjectsGrouped.lastWeek.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Last 7 days
											</div>
											{otherProjectsGrouped.lastWeek.map((project) => (
												<ProjectItem
													key={project.id}
													project={project}
													isActive={project.projectId === projectId}
													onDelete={(projectId) => {
														setDeleteId(projectId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateProject={handleUpdateProject}
												/>
											))}
										</div>
									)}

									{otherProjectsGrouped.lastMonth.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Last 30 days
											</div>
											{otherProjectsGrouped.lastMonth.map((project) => (
												<ProjectItem
													key={project.id}
													project={project}
													isActive={project.projectId === projectId}
													onDelete={(projectId) => {
														setDeleteId(projectId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateProject={handleUpdateProject}
												/>
											))}
										</div>
									)}

									{otherProjectsGrouped.older.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Older
											</div>
											{otherProjectsGrouped.older.map((project) => (
												<ProjectItem
													key={project.id}
													project={project}
													isActive={project.projectId === projectId}
													onDelete={(projectId) => {
														setDeleteId(projectId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateProject={handleUpdateProject}
												/>
											))}
										</div>
									)}
								</div>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete your
							project and remove it from our servers.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-none">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete}>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<ChatSearchCommand
				open={openCommandDialog}
				onOpenChange={setOpenCommandDialog}
				history={allProjects.map((project) => ({
					...project,
					chatId: project.projectId,
				}))}
				onSelectChat={onSelectProject}
			/>
		</>
	);
}
