"use client";

import { ChevronDownIcon, HandIcon, PencilLineIcon } from "lucide-react";
import { memo, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { PermissionMode } from "./use-settings";

interface Props {
	value: PermissionMode;
	onValueChange: (value: PermissionMode) => void;
}

const MODE_DETAILS: Record<PermissionMode, string> = {
	"ask-permissions":
		"Requires confirmation before risky commands (recommended).",
	"auto-accept-edits": "Runs risky edit commands without confirmation prompts.",
};

const MODE_LABELS: Record<PermissionMode, string> = {
	"ask-permissions": "Ask permissions",
	"auto-accept-edits": "Auto accept edits",
};

export const PermissionModeSelector = memo(function PermissionModeSelector({
	value,
	onValueChange,
}: Props) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isHoverArmed, setIsHoverArmed] = useState(false);
	const [hoveredMode, setHoveredMode] = useState<PermissionMode | null>(null);

	const renderItem = (
		mode: PermissionMode,
		icon: "hand" | "pencil",
		title: string,
	) => (
		<HoverCard
			key={mode}
			open={isMenuOpen && isHoverArmed && hoveredMode === mode}
			onOpenChange={(open) => {
				if (open && isHoverArmed) {
					setHoveredMode(mode);
					return;
				}
				setHoveredMode((prev) => (prev === mode ? null : prev));
			}}
			openDelay={160}
			closeDelay={0}
		>
			<HoverCardTrigger asChild>
				<DropdownMenuItem
					onSelect={() => onValueChange(mode)}
					className={cn("flex items-center gap-2 py-2", {
						"bg-accent/50": value === mode,
					})}
				>
					{icon === "hand" ? (
						<HandIcon className="size-4" />
					) : (
						<PencilLineIcon className="size-4" />
					)}
					<span className="text-sm">{title}</span>
				</DropdownMenuItem>
			</HoverCardTrigger>
			<HoverCardContent
				side="right"
				align="start"
				sideOffset={10}
				className="w-64"
			>
				<p className="text-xs text-muted-foreground">{MODE_DETAILS[mode]}</p>
			</HoverCardContent>
		</HoverCard>
	);

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				setIsMenuOpen(open);
				setIsHoverArmed(false);
				if (!open) setHoveredMode(null);
			}}
		>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="h-6 inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 text-xs text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
				>
					{value === "ask-permissions" ? (
						<HandIcon className="size-3.5" />
					) : (
						<PencilLineIcon className="size-3.5" />
					)}
					<span>{MODE_LABELS[value]}</span>
					<ChevronDownIcon className="size-3.5" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-56"
				onPointerMove={() => {
					if (!isHoverArmed) setIsHoverArmed(true);
				}}
			>
				<DropdownMenuGroup>
					{renderItem("ask-permissions", "hand", "Ask permissions")}
					{renderItem("auto-accept-edits", "pencil", "Auto accept edits")}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
