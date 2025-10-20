import { ModeToggle } from "@/components/mode-toggle";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
	className?: string;
}

export async function Header({ className }: Props) {
	return (
		<header className={cn("flex items-center justify-between", className)}>
			<Link href="/" className="flex items-center">
				<Terminal className="ml-1 md:ml-2.5 mr-1.5" />
				<span className="hidden md:inline text-sm uppercase font-mono font-bold tracking-tight">
					Vibe<span className="text-muted-foreground">Stack</span>
				</span>
			</Link>
			<div className="flex items-center ml-auto space-x-1.5">
				<ModeToggle />
			</div>
		</header>
	);
}
