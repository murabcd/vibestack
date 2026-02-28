"use client";

import { Loader2Icon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { ClaudeIcon, CodexIcon } from "@/components/icons/icons";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
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

const MODEL_DETAILS: Record<string, string> = {
	"openai/gpt-5.2":
		"The best model for coding and agentic tasks, with strong reasoning and tool use.",
	"openai/gpt-5-mini":
		"A faster, cost-efficient model for well-defined and everyday coding tasks.",
	"openai/gpt-5-nano":
		"Fastest, most cost-efficient model for high-throughput tasks and simple, repetitive workloads.",
	"anthropic/claude-opus-4.6":
		"Most capable Claude model, built for complex coding and agent workflows.",
	"anthropic/claude-sonnet-4.5":
		"Best model for agents, coding, and computer use, with high detail for long tasks.",
	"anthropic/claude-haiku-4-5":
		"Fastest and most cost-efficient Claude model for coding and agent tasks.",
};

function ProviderLogo({ modelId }: { modelId: string }) {
	if (modelId.startsWith("openai/")) {
		return <CodexIcon className="size-3.5 text-muted-foreground" />;
	}
	if (modelId.startsWith("anthropic/")) {
		return <ClaudeIcon className="size-3.5" />;
	}
	return null;
}

export const ModelSelector = memo(function ModelSelector({
	modelId,
	onModelChange,
}: Props) {
	const { models, isLoading, error } = useAvailableModels();
	const [isSelectOpen, setIsSelectOpen] = useState(false);
	const [isHoverArmed, setIsHoverArmed] = useState(false);
	const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
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

	const renderModelOption = (model: ModelOption) => {
		const description =
			MODEL_DETAILS[model.id] ?? "General-purpose language model.";

		return (
			<HoverCard
				key={model.id}
				open={isSelectOpen && isHoverArmed && hoveredModelId === model.id}
				onOpenChange={(open) => {
					if (open && isHoverArmed) {
						setHoveredModelId(model.id);
						return;
					}
					setHoveredModelId((prev) => (prev === model.id ? null : prev));
				}}
				openDelay={180}
				closeDelay={0}
			>
				<HoverCardTrigger asChild>
					<SelectItem value={model.id}>
						<span className="inline-flex items-center gap-2">
							<ProviderLogo modelId={model.id} />
							{model.label}
						</span>
					</SelectItem>
				</HoverCardTrigger>
				<HoverCardContent
					side="right"
					align="start"
					sideOffset={10}
					className="pointer-events-none w-56"
				>
					<p className="text-muted-foreground text-xs">{description}</p>
				</HoverCardContent>
			</HoverCard>
		);
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Select
					value={modelId}
					onValueChange={onModelChange}
					onOpenChange={(open) => {
						setIsSelectOpen(open);
						setIsHoverArmed(false);
						if (!open) {
							setHoveredModelId(null);
						}
					}}
					disabled={isLoading || !!error || !models?.length}
				>
					<SelectTrigger className="cursor-pointer h-8! border-0 bg-transparent shadow-none hover:bg-muted/50 dark:bg-transparent focus-visible:border-transparent focus-visible:ring-0">
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

					<SelectContent
						onPointerMove={() => {
							if (!isHoverArmed) {
								setIsHoverArmed(true);
							}
						}}
					>
						{openaiModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>OpenAI</SelectLabel>
								{openaiModels.map(renderModelOption)}
							</SelectGroup>
						)}

						{anthropicModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>Anthropic</SelectLabel>
								{anthropicModels.map(renderModelOption)}
							</SelectGroup>
						)}

						{otherModels.length > 0 && (
							<SelectGroup>
								<SelectLabel>Other</SelectLabel>
								{otherModels.map(renderModelOption)}
							</SelectGroup>
						)}
					</SelectContent>
				</Select>
			</TooltipTrigger>
			<TooltipContent align="end">Select model</TooltipContent>
		</Tooltip>
	);
});
