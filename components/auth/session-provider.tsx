"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
	const [session, setSession] = useState<Session | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Check for existing session on mount
		const checkSession = async () => {
			try {
				const response = await fetch("/api/auth/info");
				if (response.ok) {
					const data = await response.json();
					setSession(data.session);
				}
			} catch (error) {
				console.error("Session check error:", error);
			} finally {
				setIsLoading(false);
			}
		};

		checkSession();
	}, []);

	const signOut = () => {
		setSession(null);
	};

	return (
		<SessionContext.Provider value={{ session, isLoading, signOut }}>
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
