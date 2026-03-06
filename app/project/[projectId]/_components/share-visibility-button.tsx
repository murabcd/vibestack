"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAppHaptics } from "@/hooks/use-app-haptics";

type Visibility = "public" | "private";

interface ShareVisibilityButtonProps {
	projectId: string;
	initialVisibility: Visibility;
}

export function ShareVisibilityButton({
	projectId,
	initialVisibility,
}: ShareVisibilityButtonProps) {
	const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
	const [isUpdating, setIsUpdating] = useState(false);
	const { selection, success, error } = useAppHaptics();

	const updateVisibility = async (nextVisibility: Visibility) => {
		if (nextVisibility === visibility || isUpdating) return;
		selection();
		const previousVisibility = visibility;
		setVisibility(nextVisibility);
		setIsUpdating(true);
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					visibility: nextVisibility,
				}),
			});

			const json = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (!response.ok) {
				setVisibility(previousVisibility);
				toast.error(json?.error ?? "Failed to update visibility");
				error();
				return;
			}
			success();

			if (nextVisibility === "public") {
				try {
					const url = `${window.location.origin}/project/${projectId}`;
					await navigator.clipboard.writeText(url);
					toast("Link copied to clipboard");
					success();
				} catch {
					toast.error("Failed to copy link");
					error();
				}
			}
		} catch {
			setVisibility(previousVisibility);
			toast.error("Failed to update visibility");
			error();
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className="relative h-8 px-2 gap-1.5 cursor-pointer max-sm:size-9 max-sm:px-0"
					aria-label="Share project"
					title="Share project"
					onClick={selection}
				>
					<Share2 className="size-4 max-sm:mr-0" />
					<span className="max-sm:hidden">Share</span>
					{visibility === "public" ? (
						<span
							aria-hidden="true"
							className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border border-background bg-emerald-500"
						/>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-56 p-2">
				<div className="space-y-2">
					<Label>Project visibility</Label>
					<Select
						value={visibility}
						onValueChange={(value) => updateVisibility(value as Visibility)}
						disabled={isUpdating}
					>
						<SelectTrigger className="h-8 w-full text-xs">
							<SelectValue placeholder="Select visibility" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="private" className="cursor-pointer text-xs">
								Private
							</SelectItem>
							<SelectItem value="public" className="cursor-pointer text-xs">
								Public
							</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs leading-4 text-muted-foreground">
						Only you can view private projects.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	);
}
