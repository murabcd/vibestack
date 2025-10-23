"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Props {
	className?: string;
}

export function Header({ className }: Props) {
	const router = useRouter();

	return (
		<header className={cn("flex items-center justify-between", className)}>
			<button
				type="button"
				onClick={() => {
					router.push("/");
					router.refresh();
				}}
				className="flex items-center cursor-pointer"
			>
				<Terminal className="ml-1 md:ml-2.5 mr-1.5" />
				<span className="hidden md:inline text-sm font-semibold tracking-tight uppercase">
					Vibe<span className="text-muted-foreground">Stack</span>
				</span>
			</button>
			<div className="flex items-center ml-auto space-x-1.5">
				<ModeToggle />
			</div>
		</header>
	);
}
