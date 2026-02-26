"use client";

import { createContext, useCallback, useContext } from "react";
import useSWR from "swr";
import type { Connector } from "@/lib/db/schema";

interface ConnectorsContextType {
	connectors: Connector[];
	refreshConnectors: () => Promise<void>;
	isLoading: boolean;
}

const ConnectorsContext = createContext<ConnectorsContextType | undefined>(
	undefined,
);

export const useConnectors = () => {
	const context = useContext(ConnectorsContext);
	if (!context) {
		throw new Error("useConnectors must be used within ConnectorsProvider");
	}
	return context;
};

interface ConnectorsProviderProps {
	children: React.ReactNode;
}

export function ConnectorsProvider({ children }: ConnectorsProviderProps) {
	const { data, isLoading, mutate } = useSWR<{ data?: Connector[] }>(
		"/api/connectors",
		{
			revalidateOnFocus: false,
			dedupingInterval: 10_000,
		},
	);

	const refreshConnectors = useCallback(async () => {
		await mutate();
	}, [mutate]);

	return (
		<ConnectorsContext.Provider
			value={{
				connectors: data?.data ?? [],
				refreshConnectors,
				isLoading,
			}}
		>
			{children}
		</ConnectorsContext.Provider>
	);
}
