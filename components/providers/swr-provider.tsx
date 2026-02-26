"use client";

import { SWRConfig } from "swr";

async function fetcher<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return (await response.json()) as T;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
	return (
		<SWRConfig
			value={{
				fetcher,
				revalidateOnFocus: true,
				revalidateOnReconnect: true,
				shouldRetryOnError: true,
				errorRetryCount: 3,
				dedupingInterval: 2000,
			}}
		>
			{children}
		</SWRConfig>
	);
}
