"use client";

import { memo, useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import {
	Check,
	MoreHorizontal,
	Share2,
	Trash,
	Pencil,
	Pin,
	PinOff,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
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
import { ChatSearchCommand } from "./chat-search-command";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Chat } from "@/lib/mock-data/chats";

type GroupedChats = {
	today: Chat[];
	yesterday: Chat[];
	lastWeek: Chat[];
	lastMonth: Chat[];
	older: Chat[];
};

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
	const now = new Date();
	const oneWeekAgo = subWeeks(now, 1);
	const oneMonthAgo = subMonths(now, 1);

	return chats.reduce(
		(groups, chat) => {
			const chatDate = new Date(chat._creationTime);

			if (isToday(chatDate)) {
				groups.today.push(chat);
			} else if (isYesterday(chatDate)) {
				groups.yesterday.push(chat);
			} else if (chatDate > oneWeekAgo) {
				groups.lastWeek.push(chat);
			} else if (chatDate > oneMonthAgo) {
				groups.lastMonth.push(chat);
			} else {
				groups.older.push(chat);
			}

			return groups;
		},
		{
			today: [],
			yesterday: [],
			lastWeek: [],
			lastMonth: [],
			older: [],
		} as GroupedChats,
	);
};

const PureChatItem = ({
	chat,
	isActive,
	onDelete,
	setOpenMobile,
	onUpdateChat,
}: {
	chat: Chat;
	isActive: boolean;
	onDelete: (chatId: string) => void;
	setOpenMobile: (open: boolean) => void;
	onUpdateChat: (chatId: string, updates: Partial<Chat>) => void;
}) => {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [isRenaming, setIsRenaming] = useState(false);
	const [editingTitle, setEditingTitle] = useState(chat.title);
	const inputRef = useRef<HTMLInputElement>(null);

	const { visibilityType, setVisibilityType } = useChatVisibility({
		chatId: chat.chatId,
		initialVisibility: chat.visibility,
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

		if (newTitle && newTitle !== chat.title) {
			onUpdateChat(chat.chatId, { title: newTitle });
			toast.success("Chat renamed");
		} else {
			setEditingTitle(chat.title);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			handleRenameSubmit();
		} else if (event.key === "Escape") {
			setEditingTitle(chat.title);
			setIsRenaming(false);
		}
	};

	const handleTogglePin = () => {
		onUpdateChat(chat.chatId, { isPinned: !chat.isPinned });
		toast.success(chat.isPinned ? "Chat unpinned" : "Chat pinned");
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
						href={`/chat/${chat.chatId}`}
						onClick={() => setOpenMobile(false)}
						className="flex items-center justify-between"
					>
						<span className="truncate flex-1 mr-2">{chat.title}</span>
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
							{chat.isPinned ? (
								<PinOff className="w-4 h-4 mr-2" />
							) : (
								<Pin className="w-4 h-4 mr-2" />
							)}
							<span>{chat.isPinned ? "Unpin" : "Pin"}</span>
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
											onUpdateChat(chat.chatId, { visibility: "private" });
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
											onUpdateChat(chat.chatId, { visibility: "public" });
											const url = `${window.location.origin}/chat/${chat.chatId}`;
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
								setEditingTitle(chat.title);
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
								onDelete(chat.chatId);
								setDropdownOpen(false);
							}}
						>
							<Trash className="w-4 h-4 mr-2" />
							<span>Delete</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</SidebarMenuItem>
	);
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
	if (prevProps.isActive !== nextProps.isActive) return false;
	if (prevProps.chat.title !== nextProps.chat.title) return false;
	if (prevProps.chat.isPinned !== nextProps.chat.isPinned) return false;
	return true;
});

interface SidebarHistoryProps {
	openCommandDialog: boolean;
	setOpenCommandDialog: (open: boolean) => void;
	onSelectChat: (chatId: string) => void;
}

export function SidebarHistory({
	openCommandDialog,
	setOpenCommandDialog,
	onSelectChat,
}: SidebarHistoryProps) {
	const { setOpenMobile } = useSidebar();
	const pathname = usePathname();
	const router = useRouter();

	const chatId = useMemo(() => {
		const prefix = "/chat/";
		if (pathname.startsWith(prefix)) {
			return pathname.slice(prefix.length);
		}
		return null;
	}, [pathname]);

	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [chats, setChats] = useState<Chat[]>([]);

	// Load mock chats on mount
	useEffect(() => {
		import("@/lib/mock-data/chats").then(({ mockChats }) => {
			setChats(mockChats);
		});
	}, []);

	const handleDelete = async () => {
		if (!deleteId) return;

		setChats((prev) => prev.filter((chat) => chat.chatId !== deleteId));
		setShowDeleteDialog(false);
		setDeleteId(null);

		if (deleteId === chatId) {
			router.push("/");
		}

		toast.success("Chat deleted");
	};

	const handleUpdateChat = (chatId: string, updates: Partial<Chat>) => {
		setChats((prev) =>
			prev.map((chat) =>
				chat.chatId === chatId ? { ...chat, ...updates } : chat,
			),
		);
	};

	const { allChats, pinnedChats, otherChatsGrouped } = useMemo(() => {
		if (!chats)
			return { allChats: [], pinnedChats: [], otherChatsGrouped: null };

		const mappedChats = [...chats];

		mappedChats.sort((a, b) => {
			const pinnedA = a.isPinned ?? false;
			const pinnedB = b.isPinned ?? false;
			if (pinnedA !== pinnedB) {
				return pinnedA ? -1 : 1;
			}
			return b._creationTime - a._creationTime;
		});

		const pinned = mappedChats.filter((chat) => chat.isPinned);
		const others = mappedChats.filter((chat) => !chat.isPinned);

		return {
			allChats: mappedChats,
			pinnedChats: pinned,
			otherChatsGrouped: groupChatsByDate(others),
		};
	}, [chats]);

	if (chats.length === 0) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
						Loading chat history...
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	if (allChats.length === 0) {
		return (
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
						Your conversations will appear here once you start chatting.
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	return (
		<>
			{pinnedChats.length > 0 && (
				<SidebarGroup>
					<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
						Pinned
					</div>
					<SidebarGroupContent>
						<SidebarMenu>
							{pinnedChats.map((chat) => (
								<ChatItem
									key={chat._id}
									chat={chat}
									isActive={chat.chatId === chatId}
									onDelete={(chatId) => {
										setDeleteId(chatId);
										setShowDeleteDialog(true);
									}}
									setOpenMobile={setOpenMobile}
									onUpdateChat={handleUpdateChat}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			)}

			{otherChatsGrouped &&
				Object.values(otherChatsGrouped).some((group) => group.length > 0) && (
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<div className="flex flex-col gap-6">
									{otherChatsGrouped.today.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Today
											</div>
											{otherChatsGrouped.today.map((chat) => (
												<ChatItem
													key={chat._id}
													chat={chat}
													isActive={chat.chatId === chatId}
													onDelete={(chatId) => {
														setDeleteId(chatId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateChat={handleUpdateChat}
												/>
											))}
										</div>
									)}

									{otherChatsGrouped.yesterday.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Yesterday
											</div>
											{otherChatsGrouped.yesterday.map((chat) => (
												<ChatItem
													key={chat._id}
													chat={chat}
													isActive={chat.chatId === chatId}
													onDelete={(chatId) => {
														setDeleteId(chatId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateChat={handleUpdateChat}
												/>
											))}
										</div>
									)}

									{otherChatsGrouped.lastWeek.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Last 7 days
											</div>
											{otherChatsGrouped.lastWeek.map((chat) => (
												<ChatItem
													key={chat._id}
													chat={chat}
													isActive={chat.chatId === chatId}
													onDelete={(chatId) => {
														setDeleteId(chatId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateChat={handleUpdateChat}
												/>
											))}
										</div>
									)}

									{otherChatsGrouped.lastMonth.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Last 30 days
											</div>
											{otherChatsGrouped.lastMonth.map((chat) => (
												<ChatItem
													key={chat._id}
													chat={chat}
													isActive={chat.chatId === chatId}
													onDelete={(chatId) => {
														setDeleteId(chatId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateChat={handleUpdateChat}
												/>
											))}
										</div>
									)}

									{otherChatsGrouped.older.length > 0 && (
										<div>
											<div className="px-2 py-1 text-xs text-sidebar-foreground/50">
												Older
											</div>
											{otherChatsGrouped.older.map((chat) => (
												<ChatItem
													key={chat._id}
													chat={chat}
													isActive={chat.chatId === chatId}
													onDelete={(chatId) => {
														setDeleteId(chatId);
														setShowDeleteDialog(true);
													}}
													setOpenMobile={setOpenMobile}
													onUpdateChat={handleUpdateChat}
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
							chat and remove it from our servers.
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
				history={allChats}
				onSelectChat={onSelectChat}
			/>
		</>
	);
}
