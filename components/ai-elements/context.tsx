"use client";

import type { LanguageModelUsage } from "ai";
import { type ComponentProps, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ModelId = string;

// Convert our model IDs to tokenlens format and real pricing for Anthropic models (per 1M tokens)
// Current Anthropic pricing as of 2025
const MODEL_PRICING = {
	"anthropic:claude-sonnet-4.5": {
		inputCost: 3.0,
		outputCost: 15.0,
		maxTokens: 200000,
	},
	"anthropic:claude-4-sonnet": {
		inputCost: 3.0,
		outputCost: 15.0,
		maxTokens: 200000,
	},
	"anthropic:claude-haiku-4-5": {
		inputCost: 1.0,
		outputCost: 5.0,
		maxTokens: 200000,
	},
} as const;

// Convert our internal model IDs to tokenlens format
const toTokenlensModelId = (modelId: string): string => {
	return modelId.replace(/^anthropic\//, "anthropic:");
};

const estimateCost = (params: {
	modelId: string;
	usage: {
		promptTokens?: number;
		completionTokens?: number;
		reasoningTokens?: number;
		cachedReadTokens?: number;
	};
}) => {
	const tokenlensModelId = toTokenlensModelId(params.modelId);
	const pricing = MODEL_PRICING[tokenlensModelId as keyof typeof MODEL_PRICING];

	if (!pricing) {
		// Fallback for unknown models
		return {
			totalUSD: 0,
			inputUSD: 0,
			outputUSD: 0,
			reasoningUSD: 0,
			cacheReadUSD: 0,
		};
	}

	const inputCost =
		((params.usage.promptTokens || 0) / 1_000_000) * pricing.inputCost;
	const outputCost =
		((params.usage.completionTokens || 0) / 1_000_000) * pricing.outputCost;
	const reasoningCost =
		((params.usage.reasoningTokens || 0) / 1_000_000) * pricing.inputCost; // Usually same as input
	const cacheReadCost =
		((params.usage.cachedReadTokens || 0) / 1_000_000) *
		pricing.inputCost *
		0.5; // Cache is typically 50% of input cost

	return {
		totalUSD: inputCost + outputCost + reasoningCost + cacheReadCost,
		inputUSD: inputCost,
		outputUSD: outputCost,
		reasoningUSD: reasoningCost,
		cacheReadUSD: cacheReadCost,
	};
};

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

type ContextSchema = {
	usedTokens: number;
	maxTokens: number;
	usage?: LanguageModelUsage;
	modelId?: ModelId;
};

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
	const context = useContext(ContextContext);

	if (!context) {
		throw new Error("Context components must be used within Context");
	}

	return context;
};

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;

export const Context = ({
	usedTokens,
	maxTokens,
	usage,
	modelId,
	...props
}: ContextProps) => (
	<ContextContext.Provider
		value={{
			usedTokens,
			maxTokens,
			usage,
			modelId,
		}}
	>
		<HoverCard closeDelay={0} openDelay={0} {...props} />
	</ContextContext.Provider>
);

const ContextIcon = () => {
	const { usedTokens, maxTokens } = useContextValue();
	const circumference = 2 * Math.PI * ICON_RADIUS;
	const usedPercent = usedTokens / maxTokens;
	const dashOffset = circumference * (1 - usedPercent);

	return (
		<svg
			aria-label="Model context usage"
			height="20"
			role="img"
			style={{ color: "currentcolor" }}
			viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
			width="20"
		>
			<circle
				cx={ICON_CENTER}
				cy={ICON_CENTER}
				fill="none"
				opacity="0.25"
				r={ICON_RADIUS}
				stroke="currentColor"
				strokeWidth={ICON_STROKE_WIDTH}
			/>
			<circle
				cx={ICON_CENTER}
				cy={ICON_CENTER}
				fill="none"
				opacity="0.7"
				r={ICON_RADIUS}
				stroke="currentColor"
				strokeDasharray={`${circumference} ${circumference}`}
				strokeDashoffset={dashOffset}
				strokeLinecap="round"
				strokeWidth={ICON_STROKE_WIDTH}
				style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
			/>
		</svg>
	);
};

export type ContextTriggerProps = ComponentProps<typeof Button>;

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
	const { usedTokens, maxTokens } = useContextValue();
	const usedPercent = usedTokens / maxTokens;
	const renderedPercent = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);

	return (
		<HoverCardTrigger asChild>
			{children ?? (
				<Button type="button" variant="ghost" {...props}>
					<span className="font-medium text-muted-foreground text-xs tabular-nums">
						{renderedPercent}
					</span>
					<ContextIcon />
				</Button>
			)}
		</HoverCardTrigger>
	);
};

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export const ContextContent = ({
	className,
	...props
}: ContextContentProps) => (
	<HoverCardContent
		className={cn("min-w-[240px] divide-y overflow-hidden p-0", className)}
		{...props}
	/>
);

export type ContextContentHeader = ComponentProps<"div">;

export const ContextContentHeader = ({
	children,
	className,
	...props
}: ContextContentHeader) => {
	const { usedTokens, maxTokens } = useContextValue();
	const usedPercent = usedTokens / maxTokens;
	const displayPct = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);
	const used = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(usedTokens);
	const total = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(maxTokens);

	return (
		<div className={cn("w-full space-y-2 p-3", className)} {...props}>
			{children ?? (
				<>
					<div className="flex items-center justify-between gap-3 text-xs">
						<p className="tabular-nums">{displayPct}</p>
						<p className="text-muted-foreground tabular-nums">
							{used}&nbsp;/&nbsp;{total}
						</p>
					</div>
					<div className="space-y-2">
						<Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
					</div>
				</>
			)}
		</div>
	);
};

export type ContextContentBody = ComponentProps<"div">;

export const ContextContentBody = ({
	children,
	className,
	...props
}: ContextContentBody) => (
	<div className={cn("w-full p-3", className)} {...props}>
		{children}
	</div>
);

export type ContextContentFooter = ComponentProps<"div">;

export const ContextContentFooter = ({
	children,
	className,
	...props
}: ContextContentFooter) => {
	const { modelId, usage } = useContextValue();
	const costUSD = modelId
		? estimateCost({
				modelId,
				usage: {
					promptTokens: usage?.inputTokens ?? 0,
					completionTokens: usage?.outputTokens ?? 0,
				},
			}).totalUSD
		: undefined;
	const totalCost = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(costUSD ?? 0);

	return (
		<div
			className={cn(
				"flex w-full items-center justify-between gap-3 bg-secondary p-3 text-xs",
				className,
			)}
			{...props}
		>
			{children ?? (
				<>
					<span className="text-muted-foreground text-xs">Total cost</span>
					<span>{totalCost}</span>
				</>
			)}
		</div>
	);
};

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({
	className,
	children,
	...props
}: ContextInputUsageProps) => {
	const { usage, modelId } = useContextValue();
	const inputTokens = usage?.inputTokens ?? 0;

	if (children) {
		return children;
	}

	// Always show Input section, even with 0 tokens
	const inputCost = modelId
		? estimateCost({
				modelId,
				usage: { promptTokens: inputTokens, completionTokens: 0 },
			}).inputUSD
		: undefined;
	const inputCostText = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(inputCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Input</span>
			<TokensWithCost costText={inputCostText} tokens={inputTokens} />
		</div>
	);
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({
	className,
	children,
	...props
}: ContextOutputUsageProps) => {
	const { usage, modelId } = useContextValue();
	const outputTokens = usage?.outputTokens ?? 0;

	if (children) {
		return children;
	}

	// Always show Output section, even with 0 tokens
	const outputCost = modelId
		? estimateCost({
				modelId,
				usage: { promptTokens: 0, completionTokens: outputTokens },
			}).outputUSD
		: undefined;
	const outputCostText = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(outputCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Output</span>
			<TokensWithCost costText={outputCostText} tokens={outputTokens} />
		</div>
	);
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({
	className,
	children,
	...props
}: ContextReasoningUsageProps) => {
	const { usage, modelId } = useContextValue();
	const reasoningTokens = usage?.reasoningTokens ?? 0;

	if (children) {
		return children;
	}

	if (!reasoningTokens) {
		return null;
	}

	const reasoningCost = modelId
		? estimateCost({
				modelId,
				usage: { reasoningTokens },
			}).reasoningUSD
		: undefined;
	const reasoningCostText = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(reasoningCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Reasoning</span>
			<TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
		</div>
	);
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({
	className,
	children,
	...props
}: ContextCacheUsageProps) => {
	const { usage, modelId } = useContextValue();
	const cacheTokens = usage?.cachedInputTokens ?? 0;

	if (children) {
		return children;
	}

	// Always show Cache section, even with 0 tokens
	const cacheCost = modelId
		? estimateCost({
				modelId,
				usage: {
					cachedReadTokens: cacheTokens,
					promptTokens: 0,
					completionTokens: 0,
				},
			}).cacheReadUSD
		: undefined;
	const cacheCostText = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(cacheCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Cache</span>
			<TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
		</div>
	);
};

const TokensWithCost = ({
	tokens,
	costText,
}: {
	tokens?: number;
	costText?: string;
}) => (
	<span className="tabular-nums">
		{tokens === undefined
			? "—"
			: new Intl.NumberFormat("en-US", {
					notation: "compact",
				}).format(tokens)}
		{costText ? (
			<span className="ml-2 text-muted-foreground">•&nbsp;{costText}</span>
		) : null}
	</span>
);
