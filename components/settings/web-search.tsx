import { GlobeIcon } from "lucide-react";
import { useId } from "react";
import { useWebSearch } from "@/components/settings/use-settings";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function WebSearch() {
	const [webSearch, setWebSearch] = useWebSearch();
	const id = useId();

	const toggleWebSearch = () => {
		setWebSearch(!webSearch);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleWebSearch();
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
					onClick={toggleWebSearch}
					onKeyDown={handleKeyDown}
				>
					<div className="flex items-center gap-2.5 pointer-events-none">
						<GlobeIcon className="size-4 text-muted-foreground" />
						<Label className="text-sm text-foreground" htmlFor={id}>
							Web search
						</Label>
					</div>
					<Switch
						id={id}
						size="sm"
						className="ml-3 pointer-events-none"
						checked={webSearch}
						onCheckedChange={setWebSearch}
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
					Allows the assistant to pull current information from the web when
					needed.
				</p>
			</HoverCardContent>
		</HoverCard>
	);
}
