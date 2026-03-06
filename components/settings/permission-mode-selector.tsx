"use client";

import { HandIcon, PencilLineIcon } from "lucide-react";
import { memo, useState } from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	const [isSelectOpen, setIsSelectOpen] = useState(false);
	const [isHoverArmed, setIsHoverArmed] = useState(false);
	const [hoveredMode, setHoveredMode] = useState<PermissionMode | null>(null);

	const renderItem = (
		mode: PermissionMode,
		icon: "hand" | "pencil",
		title: string,
	) => (
		<HoverCard
			key={mode}
			open={isSelectOpen && isHoverArmed && hoveredMode === mode}
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
				<SelectItem value={mode}>
					{icon === "hand" ? (
						<HandIcon className="size-4" />
					) : (
						<PencilLineIcon className="size-4" />
					)}
					<span>{title}</span>
				</SelectItem>
			</HoverCardTrigger>
			<HoverCardContent
				side="right"
				align="start"
				sideOffset={10}
				className="pointer-events-none w-64"
			>
				<p className="text-xs text-muted-foreground">{MODE_DETAILS[mode]}</p>
			</HoverCardContent>
		</HoverCard>
	);

	return (
		<Select
			value={value}
			onValueChange={(next) => onValueChange(next as PermissionMode)}
			onOpenChange={(open) => {
				setIsSelectOpen(open);
				setIsHoverArmed(false);
				if (!open) setHoveredMode(null);
			}}
		>
			<SelectTrigger className="h-6! w-fit gap-1.5 rounded-full border border-transparent bg-transparent! px-2 py-0 text-xs text-muted-foreground shadow-none transition-colors hover:bg-accent! dark:bg-transparent! dark:hover:bg-accent! focus-visible:border-transparent focus-visible:ring-0 [&_svg]:size-3.5 [&_[data-slot=select-value]]:inline-flex [&_[data-slot=select-value]]:items-center [&_[data-slot=select-value]]:gap-1.5">
				<span className="inline-flex items-center gap-1.5">
					{value === "ask-permissions" ? (
						<HandIcon className="size-3.5" />
					) : (
						<PencilLineIcon className="size-3.5" />
					)}
					<SelectValue>{MODE_LABELS[value]}</SelectValue>
				</span>
			</SelectTrigger>
			<SelectContent
				position="popper"
				align="start"
				className="w-56"
				onPointerMove={() => {
					if (!isHoverArmed) setIsHoverArmed(true);
				}}
			>
				<SelectGroup>
					{renderItem("ask-permissions", "hand", "Ask permissions")}
					{renderItem("auto-accept-edits", "pencil", "Auto accept edits")}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
});
