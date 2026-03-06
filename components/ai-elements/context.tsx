"use client";

import { type ComponentProps, createContext, useContext } from "react";
import { Icons } from "@/components/icons/icons";
import { Button } from "@/components/ui/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import {
	getModelContextWindow,
	getModelPricing,
} from "@/lib/ai/model-metadata";
import type { AppUsage } from "@/lib/ai/usage";
import { cn } from "@/lib/utils";

type ModelId = string;

const PERCENT_MAX = 100;
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 4,
});

// Extract max tokens from TokenLens usage data or fallback to default
const getMaxTokens = (usage?: AppUsage, modelId?: string): number => {
	if (usage?.context?.totalMax) return usage.context.totalMax;
	if (usage?.context?.combinedMax) return usage.context.combinedMax;
	if (usage?.context?.inputMax) return usage.context.inputMax;
	const modelContext = getModelContextWindow(modelId);
	if (modelContext) return modelContext;
	return 200000; // Fallback to default
};

const estimateCostUSD = (
	tokens: number | undefined,
	ratePerMillion: number | undefined,
): number | undefined => {
	if (
		typeof tokens !== "number" ||
		!Number.isFinite(tokens) ||
		tokens < 0 ||
		typeof ratePerMillion !== "number" ||
		!Number.isFinite(ratePerMillion) ||
		ratePerMillion < 0
	) {
		return undefined;
	}
	return (tokens / 1_000_000) * ratePerMillion;
};

const getCostView = (usage: AppUsage | undefined, modelId?: string) => {
	const pricing = getModelPricing(modelId ?? usage?.modelId);
	const inputUSD =
		usage?.costUSD?.inputUSD ??
		estimateCostUSD(usage?.inputTokens, pricing?.inputPerMillion);
	const outputUSD =
		usage?.costUSD?.outputUSD ??
		estimateCostUSD(usage?.outputTokens, pricing?.outputPerMillion);
	const reasoningUSD =
		usage?.costUSD?.reasoningUSD ??
		estimateCostUSD(usage?.reasoningTokens, pricing?.outputPerMillion);
	let estimatedTotal = 0;
	if (typeof inputUSD === "number") {
		estimatedTotal += inputUSD;
	}
	if (typeof outputUSD === "number") {
		estimatedTotal += outputUSD;
	}
	const totalUSD = usage?.costUSD?.totalUSD ?? estimatedTotal;

	return {
		inputUSD,
		outputUSD,
		reasoningUSD,
		totalUSD: totalUSD > 0 ? totalUSD : undefined,
	};
};

const formatUsd = (value?: number): string | undefined => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return USD_FORMATTER.format(value);
};

const formatUsdOrNA = (value?: number): string => formatUsd(value) ?? "N/A";

type ContextSchema = {
	usedTokens: number;
	maxTokens?: number;
	usage?: AppUsage;
	modelId?: ModelId;
};

type ContextValue = ContextSchema & {
	isMobile: boolean;
};

const ContextContext = createContext<ContextValue | null>(null);

const useContextValue = () => {
	const context = useContext(ContextContext);

	if (!context) {
		throw new Error("Context components must be used within Context");
	}

	return context;
};

type ContextRootProps = {
	children?: React.ReactNode;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	openDelay?: number;
	closeDelay?: number;
};

export type ContextProps = ContextRootProps & ContextSchema;

export const Context = ({
	usedTokens,
	maxTokens,
	usage,
	modelId,
	children,
	open,
	defaultOpen,
	onOpenChange,
	openDelay = 0,
	closeDelay = 0,
}: ContextProps) => {
	const isMobile = useIsMobile();

	// Use dynamic max tokens from TokenLens data if available
	const dynamicMaxTokens = getMaxTokens(usage, modelId);
	const effectiveMaxTokens = maxTokens || dynamicMaxTokens;

	return (
		<ContextContext.Provider
			value={{
				usedTokens,
				maxTokens: effectiveMaxTokens,
				usage,
				modelId,
				isMobile,
			}}
		>
			{isMobile ? (
				<Popover
					open={open}
					defaultOpen={defaultOpen}
					onOpenChange={onOpenChange}
				>
					{children}
				</Popover>
			) : (
				<HoverCard
					open={open}
					defaultOpen={defaultOpen}
					onOpenChange={onOpenChange}
					closeDelay={closeDelay}
					openDelay={openDelay}
				>
					{children}
				</HoverCard>
			)}
		</ContextContext.Provider>
	);
};

const ContextIcon = () => {
	const { usedTokens, maxTokens, usage, modelId } = useContextValue();
	const effectiveMaxTokens = maxTokens || getMaxTokens(usage, modelId);
	return (
		<Icons.contextUsage
			usedTokens={usedTokens}
			maxTokens={effectiveMaxTokens}
		/>
	);
};

export type ContextTriggerProps = ComponentProps<typeof Button>;

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
	const { usedTokens, maxTokens, usage, modelId, isMobile } = useContextValue();
	const effectiveMaxTokens = maxTokens || getMaxTokens(usage, modelId);
	const usedPercent = Math.min(1, usedTokens / effectiveMaxTokens); // Cap at 100%
	const renderedPercent = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);

	return (
		<>
			{isMobile ? (
				<PopoverTrigger asChild>
					{children ?? (
						<Button type="button" variant="ghost" {...props}>
							<span className="font-medium text-muted-foreground text-xs tabular-nums">
								{renderedPercent}
							</span>
							<ContextIcon />
						</Button>
					)}
				</PopoverTrigger>
			) : (
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
			)}
		</>
	);
};

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export const ContextContent = ({
	className,
	...props
}: ContextContentProps) => {
	const { isMobile } = useContextValue();

	if (isMobile) {
		return (
			<PopoverContent
				className={cn("min-w-[240px] divide-y overflow-hidden p-0", className)}
				{...props}
			/>
		);
	}

	return (
		<HoverCardContent
			className={cn("min-w-[240px] divide-y overflow-hidden p-0", className)}
			{...props}
		/>
	);
};

export type ContextContentHeader = ComponentProps<"div">;

export const ContextContentHeader = ({
	children,
	className,
	...props
}: ContextContentHeader) => {
	const { usedTokens, maxTokens, usage, modelId } = useContextValue();
	const effectiveMaxTokens = maxTokens || getMaxTokens(usage, modelId);
	const usedPercent = Math.min(1, usedTokens / effectiveMaxTokens); // Cap at 100%
	const displayPct = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);
	const used = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(usedTokens);
	const total = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(effectiveMaxTokens);

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
	const { usage, modelId } = useContextValue();
	const costUSD = getCostView(usage, modelId).totalUSD;
	const totalCost = formatUsdOrNA(costUSD);

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
	const inputCost = getCostView(usage, modelId).inputUSD;
	const inputCostText = formatUsdOrNA(inputCost);

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
	const outputCost = getCostView(usage, modelId).outputUSD;
	const outputCostText = formatUsdOrNA(outputCost);

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

	const reasoningCost = getCostView(usage, modelId).reasoningUSD;
	const reasoningCostText = formatUsdOrNA(reasoningCost);

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
