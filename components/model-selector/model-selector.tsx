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
	type ModelOption = NonNullable<typeof models>[number];

	const { openaiModels, anthropicModels, otherModels } = useMemo(() => {
		const providerGroups = (models || []).reduce(
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
				openaiModels: [] as ModelOption[],
				anthropicModels: [] as ModelOption[],
				otherModels: [] as ModelOption[],
			},
		);

		const openAIOrder: Record<string, number> = {
			"openai/gpt-5.2": 0,
			"openai/gpt-5-mini": 1,
			"openai/gpt-5-nano": 2,
		};
		const anthropicOrder: Record<string, number> = {
			"anthropic/claude-opus-4.6": 0,
			"anthropic/claude-sonnet-4.5": 1,
			"anthropic/claude-haiku-4-5": 2,
		};

		const sortedOpenAIModels = [...providerGroups.openaiModels].sort((a, b) => {
			const aOrder = openAIOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
			const bOrder = openAIOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
			if (aOrder !== bOrder) {
				return aOrder - bOrder;
			}
			return a.label.localeCompare(b.label);
		});

		const sortedAnthropicModels = [...providerGroups.anthropicModels].sort(
			(a, b) => {
				const aOrder = anthropicOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
				const bOrder = anthropicOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
				if (aOrder !== bOrder) {
					return aOrder - bOrder;
				}
				return a.label.localeCompare(b.label);
			},
		);

		const sortedOtherModels = [...providerGroups.otherModels].sort((a, b) =>
			a.label.localeCompare(b.label),
		);

		return {
			openaiModels: sortedOpenAIModels,
			anthropicModels: sortedAnthropicModels,
			otherModels: sortedOtherModels,
		};
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
