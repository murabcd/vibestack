import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import {
	MAX_ALLOWED_SANDBOX_DURATION,
	MAX_SANDBOX_DURATION,
} from "@/lib/constants";

export type PermissionMode = "ask-permissions" | "auto-accept-edits";

export function useSettings(
	initialSandboxDuration?: number,
	initialModelId?: string,
) {
	const [modelId, setModelId] = useModelId(initialModelId);
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	const [permissionMode, setPermissionMode] = usePermissionMode();
	return {
		modelId,
		setModelId,
		fixErrors,
		reasoningEffort,
		sandboxDuration,
		permissionMode,
		setPermissionMode,
	};
}

export function useModelId(initialModelId?: string) {
	// Use useState instead of useQueryState to persist from cookie across navigations
	// This matches how useSandboxDuration works
	const [modelId, setModelId] = useState<string>(
		initialModelId ?? DEFAULT_MODEL,
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
		parseAsStringLiteral(["high", "medium", "low"]).withDefault("medium"),
	);
}

export function useFixErrors() {
	return useQueryState("fix-errors", parseAsBoolean.withDefault(true));
}

export function useSandboxDuration(initialValue?: number) {
	const clampedInitialValue = Math.min(
		MAX_ALLOWED_SANDBOX_DURATION,
		Math.max(10, initialValue ?? MAX_SANDBOX_DURATION),
	);
	const [sandboxDuration, setSandboxDuration] =
		useState<number>(clampedInitialValue);
	return [sandboxDuration, setSandboxDuration] as const;
}

export function usePermissionMode() {
	const [permissionMode, setPermissionMode] =
		useState<PermissionMode>("ask-permissions");

	useEffect(() => {
		if (typeof window === "undefined") return;
		const raw = window.localStorage.getItem("permission-mode");
		if (raw === "ask-permissions" || raw === "auto-accept-edits") {
			setPermissionMode(raw);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem("permission-mode", permissionMode);
	}, [permissionMode]);

	return [permissionMode, setPermissionMode] as const;
}
