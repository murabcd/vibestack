import {
	parseAsBoolean,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import { useState } from "react";
import { DEFAULT_MODEL, SUPPORTED_MODELS } from "@/lib/ai/constants";

export function useSettings(initialSandboxDuration?: number, initialModelId?: string) {
	const [modelId, setModelId] = useModelId(initialModelId);
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	return { modelId, setModelId, fixErrors, reasoningEffort, sandboxDuration };
}

export function useModelId(initialModelId?: string) {
	const [modelId, setModelId] = useState<string>(
		initialModelId || DEFAULT_MODEL
	);
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
