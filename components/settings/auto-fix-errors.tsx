import { WandSparklesIcon } from "lucide-react";
import { useId } from "react";
import { useFixErrors } from "@/components/settings/use-settings";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AutoFixErrors() {
	const [fixErrors, setFixErrors] = useFixErrors();
	const id = useId();

	const toggleFixErrors = () => {
		setFixErrors(!fixErrors);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleFixErrors();
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
					onClick={toggleFixErrors}
					onKeyDown={handleKeyDown}
				>
					<div className="flex items-center gap-2.5 pointer-events-none">
						<WandSparklesIcon className="size-4 text-muted-foreground" />
						<Label className="text-sm text-foreground" htmlFor={id}>
							Auto-fix errors
						</Label>
					</div>
					<Switch
						id={id}
						size="sm"
						className="ml-3 pointer-events-none"
						checked={fixErrors}
						onCheckedChange={setFixErrors}
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
					Automatically detects common runtime errors and sends a follow-up fix.
				</p>
			</HoverCardContent>
		</HoverCard>
	);
}
