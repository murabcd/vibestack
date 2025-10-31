"use client";

import { Loader2Icon } from "lucide-react";
import { memo } from "react";
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
						<SelectGroup>
							{models
								?.sort((a, b) => a.label.localeCompare(b.label))
								.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.label}
									</SelectItem>
								)) || []}
						</SelectGroup>
					</SelectContent>
				</Select>
			</TooltipTrigger>
			<TooltipContent align="end">Select model</TooltipContent>
		</Tooltip>
	);
});
