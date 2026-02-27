import { PanelLeft, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarToggle() {
	const { toggleSidebar, state } = useSidebar();
	const router = useRouter();
	const toggleSidebarTooltip =
		state === "collapsed" ? "Expand sidebar" : "Collapse sidebar";

	return (
		<div className="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						onClick={toggleSidebar}
						variant="outline"
						className="cursor-pointer md:px-2 md:h-fit"
					>
						<PanelLeft className="w-4 h-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent align="start">{toggleSidebarTooltip}</TooltipContent>
			</Tooltip>

			{state === "collapsed" && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							onClick={() => {
								router.push("/");
								router.refresh();
							}}
							variant="outline"
							className="cursor-pointer hidden md:flex md:px-2 md:h-fit"
						>
							<Plus className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent align="start">New project</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
