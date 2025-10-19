import { useId } from "react";
import { Models } from "@/ai/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useModelId, useReasoningEffort } from "./use-settings";

export function ReasoningEffort() {
	const [modelId] = useModelId();
	const [effort, setEffort] = useReasoningEffort();
	const id = useId();

	if (modelId !== Models.AnthropicClaude45Haiku) {
		return null;
	}

	const toggleEffort = () => {
		setEffort(effort === "medium" ? "low" : "medium");
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleEffort();
		}
	};

	return (
		<button
			type="button"
			className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-2 -m-2 w-full text-left"
			onClick={toggleEffort}
			onKeyDown={handleKeyDown}
		>
			<div className="space-y-1 flex-1 pointer-events-none">
				<Label className="text-sm text-foreground" htmlFor={id}>
					Higher Effort Level
				</Label>
				<p className="text-sm text-muted-foreground leading-relaxed">
					With Claude 4.5 Haiku, you can request higher reasoning effort level.
				</p>
			</div>
			<Checkbox
				id={id}
				className="ml-3 pointer-events-none"
				checked={effort === "medium"}
				onCheckedChange={(checked) =>
					setEffort(checked === true ? "medium" : "low")
				}
			/>
		</button>
	);
}
