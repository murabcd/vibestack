import { useId } from "react";
import { useFixErrors } from "@/components/settings/use-settings";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
		// biome-ignore lint/a11y/useSemanticElements: Using div for layout flexibility while maintaining button semantics
		<div
			className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-2 -m-2"
			role="button"
			tabIndex={0}
			onClick={toggleFixErrors}
			onKeyDown={handleKeyDown}
		>
			<div className="space-y-1 flex-1 pointer-events-none">
				<Label className="text-sm text-foreground" htmlFor={id}>
					Auto-fix errors
				</Label>
				<p className="text-xs text-muted-foreground leading-relaxed">
					Automatically detects and fixes errors in generated code.
				</p>
			</div>
			<Checkbox
				id={id}
				className="ml-3 pointer-events-none"
				checked={fixErrors}
				onCheckedChange={(checked) =>
					setFixErrors(checked === "indeterminate" ? false : checked)
				}
			/>
		</div>
	);
}
