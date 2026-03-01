"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
	useState,
} from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Spinner } from "@/components/chat/message-part/spinner";
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
	<div className={cn("text-muted-foreground text-xs", className)} {...props}>
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

	return (
		<TaskOpenContext.Provider value={resolvedOpen}>
			<Collapsible
				className={cn(className)}
				open={resolvedOpen}
				onOpenChange={(nextOpen) => {
					if (!isControlled) {
						setInternalOpen(nextOpen);
					}
					onOpenChange?.(nextOpen);
				}}
				{...props}
			/>
		</TaskOpenContext.Provider>
	);
};

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
	title: string;
	icon?: ReactNode;
	status?: "loading" | "done" | "error";
	hideChevron?: boolean;
};

export const TaskTrigger = ({
	children,
	className,
	title,
	icon,
	status,
	hideChevron = false,
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
					<div className="flex-1">
						{status === "loading" ? (
							<Shimmer className="text-sm text-muted-foreground">
								{title}
							</Shimmer>
						) : (
							<p>{title}</p>
						)}
					</div>
					{renderStatusIcon()}
					{hideChevron ? null : (
						<ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
					)}
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
				"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		>
			<div className="mt-4 space-y-2.5 border-muted border-l-2 pl-4">
				{children}
			</div>
		</CollapsibleContent>
	);
};
