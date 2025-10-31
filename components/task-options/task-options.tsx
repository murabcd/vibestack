import { useId } from "react";
import { ClockIcon } from "lucide-react";
import { saveSandboxDurationAsCookie } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSandboxDuration } from "@/components/settings/use-settings";

interface TaskOptionsProps {
	initialSandboxDuration?: number;
}

export function TaskOptions({ initialSandboxDuration }: TaskOptionsProps) {
	const [sandboxDuration, setSandboxDuration] = useSandboxDuration(
		initialSandboxDuration,
	);
	const id = useId();

	const durationOptions = [
		{ value: 15, label: "15 minutes" },
		{ value: 30, label: "30 minutes" },
		{ value: 60, label: "1 hour" },
		{ value: 120, label: "2 hours" },
		{ value: 300, label: "5 hours" },
	];

	const handleDurationChange = async (value: string) => {
		const duration = parseInt(value);
		setSandboxDuration(duration);
		saveSandboxDurationAsCookie(duration);
	};

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="rounded-full h-8 w-8 p-0"
						>
							<ClockIcon className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent align="end">Sandbox duration</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="w-55" align="end">
				<div className="p-2 space-y-4">
					<div className="space-y-2">
						<Select
							value={sandboxDuration?.toString()}
							onValueChange={handleDurationChange}
						>
							<SelectTrigger id={id} className="w-full h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{durationOptions.map((option) => (
									<SelectItem
										key={option.value}
										value={option.value.toString()}
									>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Maximum time a sandbox can run.
						</p>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
