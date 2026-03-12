import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import {
	MAX_ALLOWED_SANDBOX_DURATION,
	MAX_SANDBOX_DURATION,
} from "@/lib/constants";

export type PermissionMode = "ask-permissions" | "auto-accept-edits";

const MODEL_STORAGE_KEY = "selected-model";
const SETTINGS_STORAGE_EVENT = "settings-storage-change";

export function useSettings(
	initialSandboxDuration?: number,
	initialModelId?: string,
) {
	const [modelId, setModelId] = useModelId(initialModelId);
	const [fixErrors] = useFixErrors();
	const [reasoningEffort] = useReasoningEffort();
	const [webSearch] = useWebSearch();
	const [sandboxDuration] = useSandboxDuration(initialSandboxDuration);
	const [permissionMode, setPermissionMode] = usePermissionMode();
	return {
		modelId,
		setModelId,
		fixErrors,
		reasoningEffort,
		webSearch,
		sandboxDuration,
		permissionMode,
		setPermissionMode,
	};
}

export function useModelId(initialModelId?: string) {
	const [modelId, setModelId] = useState<string>(
		initialModelId ?? DEFAULT_MODEL,
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const storedModelId = window.localStorage.getItem(MODEL_STORAGE_KEY);
		if (storedModelId) {
			if (storedModelId !== modelId) {
				setModelId(storedModelId);
			}
			return;
		}

		const nextModelId = initialModelId ?? DEFAULT_MODEL;
		window.localStorage.setItem(MODEL_STORAGE_KEY, nextModelId);
		if (nextModelId !== modelId) {
			setModelId(nextModelId);
		}
	}, [initialModelId, modelId]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handleStorage = (event: StorageEvent) => {
			if (
				event.key === MODEL_STORAGE_KEY &&
				typeof event.newValue === "string" &&
				event.newValue !== modelId
			) {
				setModelId(event.newValue);
			}
		};

		const handleSettingsStorage = (event: Event) => {
			const customEvent = event as CustomEvent<{
				key?: string;
				value?: string;
			}>;
			if (
				customEvent.detail?.key === MODEL_STORAGE_KEY &&
				typeof customEvent.detail.value === "string" &&
				customEvent.detail.value !== modelId
			) {
				setModelId(customEvent.detail.value);
			}
		};

		window.addEventListener("storage", handleStorage);
		window.addEventListener(SETTINGS_STORAGE_EVENT, handleSettingsStorage);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener(SETTINGS_STORAGE_EVENT, handleSettingsStorage);
		};
	}, [modelId]);

	const setSyncedModelId = useCallback((nextModelId: string) => {
		setModelId(nextModelId);

		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(MODEL_STORAGE_KEY, nextModelId);
		window.dispatchEvent(
			new CustomEvent(SETTINGS_STORAGE_EVENT, {
				detail: {
					key: MODEL_STORAGE_KEY,
					value: nextModelId,
				},
			}),
		);
	}, []);

	return [modelId, setSyncedModelId] as const;
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

export function useWebSearch() {
	return useQueryState("web-search", parseAsBoolean.withDefault(false));
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
