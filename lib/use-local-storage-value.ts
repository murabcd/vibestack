import { useEffect, useState } from "react";

export function useLocalStorageValue(key: string) {
	const [value, setValue] = useState<string>(() => {
		if (typeof window === "undefined") {
			return "";
		}
		return localStorage.getItem(key) ?? "";
	});

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(key, value);
		}
	}, [key, value]);

	return [value, setValue] as const;
}
