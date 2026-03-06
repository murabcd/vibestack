import { BrainIcon } from "lucide-react";
import { useId } from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useReasoningEffort } from "./use-settings";

export function ReasoningEffort() {
	const [effort, setEffort] = useReasoningEffort();
	const id = useId();

	const toggleEffort = () => {
		setEffort(effort === "high" ? "medium" : "high");
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleEffort();
		}
	};

	return (
		<HoverCard openDelay={140} closeDelay={80}>
			<HoverCardTrigger asChild>
				{/* biome-ignore lint/a11y/useSemanticElements: Using div for layout flexibility while maintaining button semantics */}
				<div
					className="flex w-full items-center justify-between cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
					role="button"
					tabIndex={0}
					onClick={toggleEffort}
					onKeyDown={handleKeyDown}
				>
					<div className="flex items-center gap-2.5 pointer-events-none">
						<BrainIcon className="size-4 text-muted-foreground" />
						<Label className="text-sm text-foreground" htmlFor={id}>
							Higher effort
						</Label>
					</div>
					<Switch
						id={id}
						size="sm"
						className="ml-3 pointer-events-none"
						checked={effort === "high"}
						onCheckedChange={(checked) =>
							setEffort(checked === true ? "high" : "medium")
						}
					/>
				</div>
			</HoverCardTrigger>
			<HoverCardContent
				side="right"
				align="start"
				sideOffset={12}
				className="pointer-events-none w-56"
			>
				<p className="text-xs text-muted-foreground">
					Uses a more deliberate reasoning mode for harder tasks, with slower
					responses.
				</p>
			</HoverCardContent>
		</HoverCard>
	);
}
