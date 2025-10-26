"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/components/auth/session-provider";

export function User() {
	const { session, signOut } = useSession();

	if (!session) {
		return null;
	}

	const handleSignOut = async () => {
		try {
			await fetch("/api/auth/signout", {
				method: "POST",
			});
			signOut();
		} catch (error) {
			console.error("Sign out error:", error);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={session.user.avatar}
							alt={session.user.username}
						/>
						<AvatarFallback>
							{session.user.username.charAt(0).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<div className="flex flex-col space-y-1 p-2">
					<p className="text-sm font-medium leading-none">
						{session.user.name || session.user.username}
					</p>
					<p className="text-xs leading-none text-muted-foreground">
						{session.user.email}
					</p>
				</div>
				<DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
