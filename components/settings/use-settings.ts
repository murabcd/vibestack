import {
	parseAsBoolean,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { useState, useEffect } from "react";
import { DEFAULT_MODEL } from "@/lib/ai/constants";

export function useSettings(initialSandboxDuration?: number, initialModelId?: string) {
	const [modelId, setModelId] = useModelId(initialModelId);
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	return { modelId, setModelId, fixErrors, reasoningEffort, sandboxDuration };
}

export function useModelId(initialModelId?: string) {
	// Use useState instead of useQueryState to persist from cookie across navigations
	// This matches how useSandboxDuration works
	const [modelId, setModelId] = useState<string>(
		initialModelId ?? DEFAULT_MODEL
	);

	// Sync with initialModelId when it changes (e.g., after navigation)
	useEffect(() => {
		if (initialModelId && initialModelId !== modelId) {
			setModelId(initialModelId);
		}
	}, [initialModelId, modelId]);

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
