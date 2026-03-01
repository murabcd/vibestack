"use client";

import { createContext, useContext } from "react";
import { authClient } from "@/lib/auth/client";
import type { Session } from "@/lib/session/types";

interface SessionContextValue {
	session: Session | null;
	isLoading: boolean;
	signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
	undefined,
);

export function SessionProvider({
	children,
	initialSession,
}: {
	children: React.ReactNode;
	initialSession: Session | null;
}) {
	const { data, isPending } = authClient.useSession();
	const liveSession: Session | null = data
		? {
				created: new Date(data.session.createdAt).getTime(),
				authProvider: "github",
				user: {
					id: data.user.id,
					username:
						data.user.name || data.user.email.split("@")[0] || data.user.id,
					email: data.user.email,
					name: data.user.name,
					avatar: data.user.image ?? undefined,
				},
			}
		: null;
	const session = isPending ? (liveSession ?? initialSession) : liveSession;

	const signOut = async () => {
		await authClient.signOut();
	};

	return (
		<SessionContext.Provider value={{ session, isLoading: isPending, signOut }}>
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
