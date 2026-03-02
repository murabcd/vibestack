import { SlidersVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { AutoFixErrors } from "./auto-fix-errors";
import { ReasoningEffort } from "./reasoning-effort";

export function Settings() {
	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							type="button"
							className="cursor-pointer"
							variant="ghost"
							size="sm"
						>
							<SlidersVerticalIcon className="size-4" />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent align="end">Model settings</TooltipContent>
			</Tooltip>
			<PopoverContent className="p-0 min-w-80">
				<div className="p-4 space-y-6">
					<AutoFixErrors />
					<ReasoningEffort />
				</div>
			</PopoverContent>
		</Popover>
	);
}
