"use client";

import { ChevronUp, LogOut, Moon, Sun, Vibrate } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRef } from "react";
import { useSession } from "@/components/auth/session-provider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { useAppHaptics } from "@/hooks/use-app-haptics";

export function SidebarUserNav() {
	const { session, signOut } = useSession();
	const { setTheme, resolvedTheme } = useTheme();
	const { isMobile } = useSidebar();
	const { isEnabled, setEnabled, selection } = useAppHaptics();
	const triggerRef = useRef<HTMLButtonElement>(null);

	if (!session) {
		return null;
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							ref={triggerRef}
							className="cursor-pointer h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Image
								alt={
									session.user.name || session.user.username || "User Avatar"
								}
								className="rounded-full"
								height={24}
								src={session.user.avatar || "/vercel.svg"}
								width={24}
							/>
							<span className="truncate">
								{session.user.name ||
									session.user.username ||
									session.user.email}
							</span>
							<ChevronUp className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[var(--radix-popper-anchor-width)]"
						side="top"
						align="start"
					>
						<DropdownMenuItem
							className="cursor-pointer w-full flex items-center"
							onClick={() => {
								selection();
								setTheme(resolvedTheme === "dark" ? "light" : "dark");
							}}
						>
							{resolvedTheme === "dark" ? (
								<Sun className="mr-2 size-4" />
							) : (
								<Moon className="mr-2 size-4" />
							)}
							{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
						</DropdownMenuItem>
						{isMobile ? (
							<DropdownMenuItem
								className="w-full flex items-center justify-between gap-2 cursor-pointer"
								onSelect={(event) => {
									event.preventDefault();
								}}
								onClick={() => {
									setEnabled(!isEnabled);
									selection();
								}}
							>
								<span className="flex items-center gap-2">
									<Vibrate className="size-4 mr-2" />
									Haptic feedback
								</span>
								<Switch
									checked={isEnabled}
									aria-label="Toggle haptic feedback"
									onCheckedChange={(checked) => {
										setEnabled(checked);
										selection();
									}}
									onClick={(event) => {
										event.stopPropagation();
									}}
								/>
							</DropdownMenuItem>
						) : null}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="cursor-pointer w-full flex items-center"
							onClick={() => {
								selection();
								void signOut();
							}}
						>
							<LogOut className="mr-2 size-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
