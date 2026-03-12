import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL } from "@/lib/ai/constants";
import {
	MAX_ALLOWED_SANDBOX_DURATION,
	MAX_SANDBOX_DURATION,
} from "@/lib/constants";

export type PermissionMode = "ask-permissions" | "auto-accept-edits";

const REASONING_EFFORT_VALUES = ["high", "medium", "low"] as const;

const MODEL_STORAGE_KEY = "selected-model";
const FIX_ERRORS_STORAGE_KEY = "fix-errors";
const WEB_SEARCH_STORAGE_KEY = "web-search";
const REASONING_EFFORT_STORAGE_KEY = "reasoning-effort";
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
	const [reasoningEffort, setReasoningEffort] = useQueryState(
		"effort",
		parseAsStringLiteral(REASONING_EFFORT_VALUES).withDefault("medium"),
	);
	const hasHydratedReasoningEffort = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (hasHydratedReasoningEffort.current) {
			return;
		}
		hasHydratedReasoningEffort.current = true;

		const hasQueryValue = new URLSearchParams(window.location.search).has(
			"effort",
		);
		if (hasQueryValue) {
			return;
		}

		const storedEffort = window.localStorage.getItem(
			REASONING_EFFORT_STORAGE_KEY,
		);
		if (
			storedEffort === "high" ||
			storedEffort === "medium" ||
			storedEffort === "low"
		) {
			if (storedEffort !== reasoningEffort) {
				void setReasoningEffort(storedEffort);
			}
			return;
		}

		window.localStorage.setItem(REASONING_EFFORT_STORAGE_KEY, reasoningEffort);
	}, [reasoningEffort, setReasoningEffort]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(REASONING_EFFORT_STORAGE_KEY, reasoningEffort);
	}, [reasoningEffort]);

	return [reasoningEffort, setReasoningEffort] as const;
}

export function useFixErrors() {
	return usePersistedBooleanQueryState(
		"fix-errors",
		FIX_ERRORS_STORAGE_KEY,
		true,
	);
}

export function useWebSearch() {
	return usePersistedBooleanQueryState(
		"web-search",
		WEB_SEARCH_STORAGE_KEY,
		false,
	);
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

function usePersistedBooleanQueryState(
	queryKey: string,
	storageKey: string,
	defaultValue: boolean,
) {
	const [value, setValue] = useQueryState(
		queryKey,
		parseAsBoolean.withDefault(defaultValue),
	);
	const hasHydratedFromStorage = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (hasHydratedFromStorage.current) {
			return;
		}
		hasHydratedFromStorage.current = true;

		const hasQueryValue = new URLSearchParams(window.location.search).has(
			queryKey,
		);
		if (hasQueryValue) {
			return;
		}

		const storedValue = window.localStorage.getItem(storageKey);
		if (storedValue === "true" || storedValue === "false") {
			const nextValue = storedValue === "true";
			if (nextValue !== value) {
				void setValue(nextValue);
			}
			return;
		}

		window.localStorage.setItem(storageKey, String(value));
	}, [queryKey, storageKey, setValue, value]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(storageKey, String(value));
	}, [storageKey, value]);

	return [value, setValue] as const;
}
