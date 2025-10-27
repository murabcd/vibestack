import {
	parseAsBoolean,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { useState, useEffect } from "react";
import { DEFAULT_MODEL, SUPPORTED_MODELS } from "@/lib/ai/constants";

export function useSettings(initialSandboxDuration?: number, initialModelId?: string) {
	const [modelId, setModelId] = useModelId(initialModelId);
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	return { modelId, setModelId, fixErrors, reasoningEffort, sandboxDuration };
}

export function useModelId(initialModelId?: string) {
	const [modelId, setModelId] = useQueryState(
		"model",
		parseAsStringLiteral(SUPPORTED_MODELS).withDefault(DEFAULT_MODEL),
	);

	// Set initial model from cookie/props on mount if provided and query state is default
	useEffect(() => {
		if (initialModelId && modelId === DEFAULT_MODEL) {
			setModelId(initialModelId);
		}
	}, [initialModelId, modelId, setModelId]);

	return [modelId, setModelId] as const;
}

export function useReasoningEffort() {
	return useQueryState(
		"effort",
		parseAsStringLiteral(["medium", "low"]).withDefault("low"),
	);
}

export function useFixErrors() {
	return useQueryState("fix-errors", parseAsBoolean.withDefault(true));
}

export function useSandboxDuration(initialValue?: number) {
	const [sandboxDuration, setSandboxDuration] = useState<number>(
		initialValue ?? 60
	);
	return [sandboxDuration, setSandboxDuration] as const;
}
