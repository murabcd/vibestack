import { PanelLeft, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { useRouter } from "next/navigation";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarToggle() {
	const { toggleSidebar } = useSidebar();
	const router = useRouter();

	return (
		<div className="flex items-center justify-between w-full">
			<div className="flex items-center gap-2">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							onClick={toggleSidebar}
							variant="outline"
							className="md:px-2 md:h-fit"
						>
							<PanelLeft className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent align="start">Toggle sidebar</TooltipContent>
				</Tooltip>

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
			</div>

			<div className="flex items-center">
				<ModeToggle />
			</div>
		</div>
	);
}
