import {
	parseAsBoolean,
	parseAsStringLiteral,
	parseAsInteger,
	useQueryState,
} from "nuqs";
import { DEFAULT_MODEL, SUPPORTED_MODELS } from "@/lib/ai/constants";

export function useSettings(initialSandboxDuration?: number) {
	const [modelId] = useModelId();
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	return { modelId, fixErrors, reasoningEffort, sandboxDuration };
}

export function useModelId() {
	return useQueryState(
		"modelId",
		parseAsStringLiteral(SUPPORTED_MODELS.map((model) => model)).withDefault(
			DEFAULT_MODEL,
		),
	);
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
	return useQueryState(
		"sandbox-duration",
		parseAsInteger.withDefault(initialValue ?? 60),
	);
}
