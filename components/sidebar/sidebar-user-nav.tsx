"use client";

import { ChevronUp, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRef } from "react";
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
} from "@/components/ui/sidebar";
import { useSession } from "@/components/auth/session-provider";

export function SidebarUserNav() {
	const { session, signOut } = useSession();
	const { setTheme, resolvedTheme } = useTheme();
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
							className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
							className="cursor-pointer w-full block"
							onClick={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
						>
							{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="cursor-pointer w-full block"
							onClick={() => {
								signOut();
							}}
						>
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
