"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HapticInput } from "web-haptics";
import { useWebHaptics } from "web-haptics/react";
import { useIsMobile } from "@/hooks/use-mobile";

const HAPTICS_STORAGE_KEY = "haptics-enabled";
const HAPTICS_COOLDOWN_MS = 180;
const HAPTICS_EVENT_NAME = "app-haptics-preference";

function readHapticsPreference(): boolean | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	const value = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
	if (value === null) {
		return undefined;
	}

	return value === "true";
}

function writeHapticsPreference(enabled: boolean): void {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
}

export function useAppHaptics() {
	const isMobile = useIsMobile();
	const { trigger, isSupported } = useWebHaptics();
	const [userPreference, setUserPreference] = useState<boolean | undefined>(
		undefined,
	);
	const lastTriggeredAtRef = useRef(0);

	useEffect(() => {
		setUserPreference(readHapticsPreference());

		const onStorage = (event: StorageEvent) => {
			if (event.key === HAPTICS_STORAGE_KEY) {
				setUserPreference(
					event.newValue === null ? undefined : event.newValue === "true",
				);
			}
		};
		const onPreferenceUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<boolean>;
			setUserPreference(customEvent.detail);
		};

		window.addEventListener("storage", onStorage);
		window.addEventListener(HAPTICS_EVENT_NAME, onPreferenceUpdate);

		return () => {
			window.removeEventListener("storage", onStorage);
			window.removeEventListener(HAPTICS_EVENT_NAME, onPreferenceUpdate);
		};
	}, []);

	const isEnabled = useMemo(() => {
		if (typeof userPreference === "boolean") {
			return userPreference;
		}

		// Mobile defaults to on. Web defaults to off.
		return isMobile;
	}, [isMobile, userPreference]);

	const setEnabled = useCallback((enabled: boolean) => {
		setUserPreference(enabled);
		writeHapticsPreference(enabled);
		window.dispatchEvent(
			new CustomEvent<boolean>(HAPTICS_EVENT_NAME, { detail: enabled }),
		);
	}, []);

	const emit = useCallback(
		(pattern: HapticInput) => {
			if (!isMobile || !isEnabled) {
				return;
			}

			const now = Date.now();
			if (now - lastTriggeredAtRef.current < HAPTICS_COOLDOWN_MS) {
				return;
			}
			lastTriggeredAtRef.current = now;

			void trigger(pattern);
		},
		[isEnabled, isMobile, trigger],
	);

	return {
		isMobile,
		isEnabled,
		isSupported,
		setEnabled,
		trigger: emit,
		selection: () => emit("selection"),
		success: () => emit("success"),
		error: () => emit("error"),
		warning: () => emit("warning"),
	};
}
