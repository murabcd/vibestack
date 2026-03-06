import { Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { AutoFixErrors } from "./auto-fix-errors";
import { ReasoningEffort } from "./reasoning-effort";
import { WebSearch } from "./web-search";

export function Settings() {
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							className="cursor-pointer"
							variant="ghost"
							size="sm"
						>
							<Settings2Icon className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent align="end">Model settings</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="w-56 rounded-md p-2">
				<DropdownMenuGroup className="space-y-1">
					<WebSearch />
					<AutoFixErrors />
					<ReasoningEffort />
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
