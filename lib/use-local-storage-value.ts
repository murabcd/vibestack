import { useEffect, useState } from "react";

export function useLocalStorageValue(key: string) {
	const [value, setValue] = useState<string>("");
	const [hasLoaded, setHasLoaded] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		setValue(localStorage.getItem(key) ?? "");
		setHasLoaded(true);
	}, [key]);

	useEffect(() => {
		if (typeof window === "undefined" || !hasLoaded) {
			return;
		}

		localStorage.setItem(key, value);
	}, [key, value, hasLoaded]);

	return [value, setValue] as const;
}
