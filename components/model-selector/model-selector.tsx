"use client";

import { Loader2Icon } from "lucide-react";
import { memo, useMemo } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAvailableModels } from "./use-available-models";

interface Props {
	modelId: string;
	onModelChange: (modelId: string) => void;
}

export const ModelSelector = memo(function ModelSelector({
	modelId,
	onModelChange,
}: Props) {
	const { models, isLoading, error } = useAvailableModels();

	const { openaiModels, anthropicModels, otherModels } = useMemo(() => {
		const sortedModels = [...(models || [])].sort((a, b) =>
			a.label.localeCompare(b.label),
		);

		return sortedModels.reduce(
			(acc, model) => {
				const provider = model.id.split("/")[0]?.toLowerCase();
				if (provider === "openai") {
					acc.openaiModels.push(model);
					return acc;
				}
				if (provider === "anthropic") {
					acc.anthropicModels.push(model);
					return acc;
				}
				acc.otherModels.push(model);
				return acc;
			},
			{
				openaiModels: [] as typeof sortedModels,
				anthropicModels: [] as typeof sortedModels,
				otherModels: [] as typeof sortedModels,
			},
		);
	}, [models]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Select
					value={modelId}
					onValueChange={onModelChange}
					disabled={isLoading || !!error || !models?.length}
				>
					<SelectTrigger className="bg-background cursor-pointer h-8!">
						{isLoading ? (
							<div className="flex items-center gap-2">
								<Loader2Icon className="size-4 animate-spin" />
								<span>Loading</span>
							</div>
						) : error ? (
							<span className="text-destructive text-sm">Error</span>
						) : !models?.length ? (
							<span>No models</span>
						) : (
							<SelectValue placeholder="Select a model" />
						)}
					</SelectTrigger>

					<SelectContent>
						{openaiModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>OpenAI</SelectLabel>
								{openaiModels.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.label}
									</SelectItem>
								))}
							</SelectGroup>
						)}

						{anthropicModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>Anthropic</SelectLabel>
								{anthropicModels.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.label}
									</SelectItem>
								))}
							</SelectGroup>
						)}

						{otherModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>Other</SelectLabel>
								{otherModels.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.label}
									</SelectItem>
								))}
							</SelectGroup>
						)}
					</SelectContent>
				</Select>
			</TooltipTrigger>
			<TooltipContent align="end">Select model</TooltipContent>
		</Tooltip>
	);
});
