import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
	className?: string;
	children: ReactNode;
}

export function Panel({ className, children }: Props) {
	return (
		<div
			className={cn(
				"flex flex-col relative border border-border w-full h-full shadow-sm rounded-lg",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function PanelHeader({ className, children }: Props) {
	return (
		<div
			className={cn(
				"text-xs flex items-center border-b border-border px-2.5 py-1 text-muted-foreground bg-secondary/30 font-medium",
				className,
			)}
		>
			{children}
		</div>
	);
}
