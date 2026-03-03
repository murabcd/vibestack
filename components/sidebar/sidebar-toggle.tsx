import { PanelLeft, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppHaptics } from "@/hooks/use-app-haptics";

export function SidebarToggle() {
	const { toggleSidebar, state } = useSidebar();
	const { selection } = useAppHaptics();
	const router = useRouter();
	const toggleSidebarTooltip =
		state === "collapsed" ? "Expand sidebar" : "Collapse sidebar";

	return (
		<div className="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						onClick={() => {
							selection();
							toggleSidebar();
						}}
						variant="outline"
						className="cursor-pointer md:size-8"
					>
						<PanelLeft className="w-4 h-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent align="start">
					{toggleSidebarTooltip} <Kbd>⌘B</Kbd>
				</TooltipContent>
			</Tooltip>

			{state === "collapsed" && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							onClick={() => {
								selection();
								router.push("/");
								router.refresh();
							}}
							variant="outline"
							className="cursor-pointer hidden md:flex md:size-8"
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
