import { ClockIcon } from "lucide-react";
import { useId } from "react";
import { saveSandboxDurationAsCookie } from "@/app/actions";
import { useSandboxDuration } from "@/components/settings/use-settings";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
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

interface TaskOptionsProps {
	initialSandboxDuration?: number;
	compact?: boolean;
}

export function TaskOptions({
	initialSandboxDuration,
	compact = false,
}: TaskOptionsProps) {
	const [sandboxDuration, setSandboxDuration] = useSandboxDuration(
		initialSandboxDuration,
	);
	const id = useId();

	const durationOptions = [
		{ value: 15, label: "15 minutes" },
		{ value: 30, label: "30 minutes" },
		{ value: 45, label: "45 minutes" },
	];

	const handleDurationChange = async (value: string) => {
		const duration = parseInt(value, 10);
		setSandboxDuration(duration);
		saveSandboxDurationAsCookie(duration);
	};

	const selectedLabel =
		durationOptions.find((option) => option.value === sandboxDuration)?.label ??
		`${sandboxDuration} minutes`;

	if (compact) {
		return (
			<Select
				value={sandboxDuration?.toString()}
				onValueChange={handleDurationChange}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<SelectTrigger className="!h-6 w-fit gap-1.5 rounded-full border border-transparent !bg-transparent px-2 py-0 text-xs text-muted-foreground shadow-none transition-colors hover:!bg-accent dark:!bg-transparent dark:hover:!bg-accent focus-visible:border-transparent focus-visible:ring-0 [&_svg]:size-3.5 [&_[data-slot=select-value]]:inline-flex [&_[data-slot=select-value]]:items-center [&_[data-slot=select-value]]:gap-1.5">
							<span className="inline-flex items-center gap-1.5">
								<ClockIcon className="size-3.5" />
								<SelectValue>{selectedLabel}</SelectValue>
							</span>
						</SelectTrigger>
					</TooltipTrigger>
					<TooltipContent align="end">Sandbox duration</TooltipContent>
				</Tooltip>
				<SelectContent position="popper" align="start" className="w-40">
					{durationOptions.map((option) => (
						<SelectItem key={option.value} value={option.value.toString()}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="cursor-pointer rounded-full h-8 w-8 p-0"
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
						<Label htmlFor={id}>Maximum duration</Label>
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
							How long the sandbox can run.
						</p>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
