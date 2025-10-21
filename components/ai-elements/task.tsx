"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, SearchIcon, CheckIcon, XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "@/components/chat/message-part/spinner";

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
	<div className={cn("text-muted-foreground text-xs", className)} {...props}>
		{children}
	</div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = ({
	defaultOpen = true,
	className,
	...props
}: TaskProps) => (
	<Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
	title: string;
	icon?: ReactNode;
	status?: "loading" | "done" | "error";
};

export const TaskTrigger = ({
	children,
	className,
	title,
	icon,
	status,
	...props
}: TaskTriggerProps) => {
	const renderStatusIcon = () => {
		if (!status) return null;

		if (status === "loading") {
			return <Spinner loading={true} className="size-4" />;
		}
		if (status === "done") {
			return <CheckIcon className="size-4" />;
		}
		if (status === "error") {
			return <XIcon className="size-4 text-destructive" />;
		}
		return null;
	};

	return (
		<CollapsibleTrigger asChild className={cn("group", className)} {...props}>
			{children ?? (
				<div className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
					{icon ?? <SearchIcon className="size-4" />}
					<p className="flex-1">{title}</p>
					{renderStatusIcon()}
					<ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
				</div>
			)}
		</CollapsibleTrigger>
	);
};

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
	children,
	className,
	...props
}: TaskContentProps) => (
	<CollapsibleContent
		className={cn(
			"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
			className,
		)}
		{...props}
	>
		<div className="mt-4 space-y-2 border-muted border-l-2 pl-4">
			{children}
		</div>
	</CollapsibleContent>
);
