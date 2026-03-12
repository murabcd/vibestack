"use client";

import {
	BrainIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	FileCheck2Icon,
	FileCode2Icon,
	FolderCogIcon,
	GlobeIcon,
	SearchIcon,
	SettingsIcon,
	SquareTerminalIcon,
	WrenchIcon,
	XIcon,
} from "lucide-react";
import {
	type ComponentProps,
	type ComponentType,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type TaskItemFileProps = ComponentProps<"div">;

export const TaskItemFile = ({
	children,
	className,
	...props
}: TaskItemFileProps) => (
	<div
		className={cn(
			"inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

export type TaskItemProps = ComponentProps<"div">;

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
	<div
		className={cn(
			"text-[11px] leading-tight text-muted-foreground/75",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

const TaskOpenContext = createContext<boolean>(false);

export const Task = ({
	defaultOpen = false,
	className,
	open,
	onOpenChange,
	...props
}: TaskProps) => {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const isControlled = typeof open === "boolean";
	const resolvedOpen = isControlled ? open : internalOpen;
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!isControlled) {
				setInternalOpen(nextOpen);
			}
			onOpenChange?.(nextOpen);
		},
		[isControlled, onOpenChange],
	);

	return (
		<TaskOpenContext.Provider value={resolvedOpen}>
			<Collapsible
				className={cn(className)}
				open={resolvedOpen}
				onOpenChange={handleOpenChange}
				{...props}
			/>
		</TaskOpenContext.Provider>
	);
};

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
	title: string;
	icon?: ReactNode;
	iconName?:
		| "thinking"
		| "sandbox"
		| "files"
		| "files-verified"
		| "command"
		| "link"
		| "settings"
		| "wrench";
	status?: "loading" | "done" | "error";
	hideChevron?: boolean;
	meta?: ReactNode;
};

export const TaskTrigger = ({
	children,
	className,
	title,
	icon,
	iconName,
	status,
	hideChevron = false,
	meta,
	...props
}: TaskTriggerProps) => {
	const IconFromName = getTaskIconByName(iconName);

	return (
		<CollapsibleTrigger asChild className={cn("group", className)} {...props}>
			{children ?? (
				<div
					className={cn(
						"group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left outline-none transition-colors",
						!hideChevron && "cursor-pointer",
					)}
				>
					{icon ??
						(IconFromName ? (
							<IconFromName className="size-3.5 shrink-0 text-muted-foreground/55 transition-colors group-hover:text-muted-foreground/80" />
						) : (
							<SearchIcon className="size-3.5 shrink-0 text-muted-foreground/55 transition-colors group-hover:text-muted-foreground/80" />
						))}
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						{status === "loading" ? (
							<div className="min-w-0 truncate font-mono text-[11px] leading-tight text-muted-foreground/80 transition-colors group-hover:text-foreground/85">
								<Shimmer
									as="span"
									className="truncate font-mono text-[11px] leading-tight text-muted-foreground/80 transition-colors group-hover:text-foreground/85"
								>
									{title}
								</Shimmer>
							</div>
						) : (
							<p className="min-w-0 truncate font-mono text-[11px] leading-tight text-muted-foreground/80 transition-colors group-hover:text-foreground/85">
								{title}
							</p>
						)}
						{meta ? (
							<span className="shrink-0 font-mono text-[11px] leading-tight text-muted-foreground/80 tabular-nums transition-colors group-hover:text-foreground/85">
								{meta}
							</span>
						) : null}
						{hideChevron ? null : (
							<span className="shrink-0 cursor-pointer text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/70">
								<ChevronRightIcon className="size-3 group-data-[state=open]:hidden" />
								<ChevronDownIcon className="hidden size-3 group-data-[state=open]:block" />
							</span>
						)}
					</div>
					{status === "error" ? (
						<XIcon className="size-3 text-destructive/85" />
					) : null}
				</div>
			)}
		</CollapsibleTrigger>
	);
};

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
	children,
	className,
	lazy = true,
	...props
}: TaskContentProps & { lazy?: boolean }) => {
	const isOpen = useContext(TaskOpenContext);

	if (lazy && !isOpen) {
		return null;
	}

	return (
		<CollapsibleContent
			className={cn(
				"overflow-hidden text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
				className,
			)}
			{...props}
		>
			<div className="mb-1 ml-2.5 mt-0.5 space-y-1 border-l border-muted/15 pl-1.5">
				{children}
			</div>
		</CollapsibleContent>
	);
};

function getTaskIconByName(
	name: TaskTriggerProps["iconName"],
): ComponentType<{ className?: string }> | null {
	if (!name) return null;
	if (name === "thinking") return BrainIcon;
	if (name === "sandbox") return FolderCogIcon;
	if (name === "files") return FileCode2Icon;
	if (name === "files-verified") return FileCheck2Icon;
	if (name === "command") return SquareTerminalIcon;
	if (name === "link") return GlobeIcon;
	if (name === "settings") return SettingsIcon;
	if (name === "wrench") return WrenchIcon;
	return null;
}
