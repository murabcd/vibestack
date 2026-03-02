import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
		// biome-ignore lint/a11y/useSemanticElements: Using div for layout flexibility while maintaining button semantics
		<div
			className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-2 -m-2"
			role="button"
			tabIndex={0}
			onClick={toggleEffort}
			onKeyDown={handleKeyDown}
		>
			<div className="space-y-1 flex-1 pointer-events-none">
				<Label className="text-sm text-foreground" htmlFor={id}>
					Higher effort level
				</Label>
				<p className="text-xs text-muted-foreground leading-relaxed">
					Use high reasoning effort.
				</p>
			</div>
			<Checkbox
				id={id}
				className="ml-3 pointer-events-none"
				checked={effort === "high"}
				onCheckedChange={(checked) =>
					setEffort(checked === true ? "high" : "medium")
				}
			/>
		</div>
	);
}
