"use client";

import { ServerIcon } from "lucide-react";
import { Icons } from "@/components/icons/icons";
import { cn } from "@/lib/utils";

type ConnectorIconKey =
	| "browserbase"
	| "context7"
	| "convex"
	| "figma"
	| "huggingFace"
	| "linear"
	| "notion"
	| "playwright"
	| "supabase";

interface ResolveConnectorIconInput {
	baseUrl?: string | null;
	command?: string | null;
	name?: string | null;
}

interface ConnectorBrandIconProps extends ResolveConnectorIconInput {
	className?: string;
	iconClassName?: string;
}

function normalize(value?: string | null) {
	return value?.trim().toLowerCase() ?? "";
}

export function resolveConnectorIconKey({
	baseUrl,
	command,
	name,
}: ResolveConnectorIconInput): ConnectorIconKey | undefined {
	const normalizedName = normalize(name);
	const normalizedUrl = normalize(baseUrl);
	const normalizedCommand = normalize(command);
	const haystack = `${normalizedName} ${normalizedUrl} ${normalizedCommand}`;

	if (haystack.includes("browserbase")) return "browserbase";
	if (haystack.includes("context7") || haystack.includes("mcp.context7.com")) {
		return "context7";
	}
	if (haystack.includes("convex")) return "convex";
	if (haystack.includes("figma")) return "figma";
	if (
		haystack.includes("hugging face") ||
		haystack.includes("huggingface") ||
		haystack.includes("hf.co/mcp")
	) {
		return "huggingFace";
	}
	if (haystack.includes("linear")) return "linear";
	if (haystack.includes("notion")) return "notion";
	if (haystack.includes("playwright")) return "playwright";
	if (haystack.includes("supabase")) return "supabase";

	return undefined;
}

export function ConnectorBrandIcon({
	baseUrl,
	className,
	command,
	iconClassName,
	name,
}: ConnectorBrandIconProps) {
	const iconKey = resolveConnectorIconKey({ name, command, baseUrl });
	const IconComponent = iconKey ? Icons[iconKey] : ServerIcon;

	return (
		<div
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-xl border border-border/80 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
				className,
			)}
		>
			<IconComponent
				className={cn(
					"size-4.5 text-foreground/85",
					!iconKey && "text-muted-foreground",
					iconClassName,
				)}
			/>
		</div>
	);
}
