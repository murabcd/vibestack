import { SlidersVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AutoFixErrors } from "./auto-fix-errors";
import { ReasoningEffort } from "./reasoning-effort";

interface SettingsProps {
	modelId?: string;
}

export function Settings({ modelId }: SettingsProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button className="cursor-pointer" variant="ghost" size="sm">
					<SlidersVerticalIcon className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-96">
				<div className="p-4 space-y-6">
					<AutoFixErrors />
					<ReasoningEffort modelId={modelId} />
				</div>
			</PopoverContent>
		</Popover>
	);
}
