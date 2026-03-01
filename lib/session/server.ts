import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/better-auth";
import type { Session } from "./types";

function toSession(
	data: Awaited<ReturnType<typeof auth.api.getSession>>,
): Session | undefined {
	if (!data) {
		return;
	}

	return {
		created: new Date(data.session.createdAt).getTime(),
		authProvider: "github",
		user: {
			id: data.user.id,
			username: data.user.name || data.user.email.split("@")[0] || data.user.id,
			email: data.user.email,
			name: data.user.name,
			avatar: data.user.image ?? undefined,
		},
	};
}

export async function getSessionFromCookie(
	_cookieValue?: string,
): Promise<Session | undefined> {
	const requestHeaders = new Headers(await headers());
	const session = await auth.api.getSession({
		headers: requestHeaders,
	});

	return toSession(session);
}

export async function getSessionFromReq(
	req: NextRequest,
): Promise<Session | undefined> {
	const session = await auth.api.getSession({
		headers: req.headers,
	});

	return toSession(session);
}
