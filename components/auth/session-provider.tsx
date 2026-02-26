"use client";

import { createContext, useContext } from "react";
import useSWR from "swr";
import type { Session } from "@/lib/session/types";

interface SessionContextValue {
	session: Session | null;
	isLoading: boolean;
	signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
	undefined,
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
	const { data, isLoading, mutate } = useSWR<{ session: Session | null }>(
		"/api/auth/info",
		{
			revalidateOnFocus: false,
			onError: (error) => {
				console.error("Session check error:", error);
			},
		},
	);

	const signOut = () => {
		void mutate({ session: null }, { revalidate: false });
	};

	return (
		<SessionContext.Provider
			value={{ session: data?.session ?? null, isLoading, signOut }}
		>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession() {
	const context = useContext(SessionContext);
	if (context === undefined) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return context;
}
