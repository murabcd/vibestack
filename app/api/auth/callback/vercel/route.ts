import { OAuth2Client, type OAuth2Tokens } from "arctic";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createSession, saveSession } from "@/lib/session/create";

export async function GET(req: NextRequest): Promise<Response> {
	const url = new URL(req.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		return Response.redirect(new URL(`/?error=${error}`, req.url));
	}

	if (!code || !state) {
		return Response.redirect(new URL("/?error=missing_code_or_state", req.url));
	}

	const store = await cookies();
	const storedState = store.get("vercel_oauth_state")?.value;
	const redirectTo = store.get("vercel_oauth_redirect_to")?.value ?? "/";
	const codeVerifier = store.get("vercel_oauth_code_verifier")?.value;

	if (!storedState || storedState !== state || !codeVerifier) {
		return Response.redirect(new URL("/?error=invalid_state", req.url));
	}

	try {
		const client = new OAuth2Client(
			process.env.NEXT_PUBLIC_VERCEL_CLIENT_ID || "",
			process.env.VERCEL_CLIENT_SECRET || "",
			`${req.nextUrl.origin}/api/auth/callback/vercel`,
		);

		// Exchange code for access token
		const tokens: OAuth2Tokens = await client.validateAuthorizationCode(
			"https://vercel.com/api/login/oauth/token",
			code,
			codeVerifier,
		);

		// Fetch user data from Vercel
		const userResponse = await fetch("https://api.vercel.com/v2/user", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`,
			},
		});

		const userData = await userResponse.json();

		// Create session with real Vercel user data
		const session = await createSession(
			{
				accessToken: tokens.accessToken(),
				refreshToken: tokens.hasRefreshToken()
					? tokens.refreshToken()
					: undefined,
			},
			"vercel",
			{
				externalId: userData.uid || userData.id,
				username: userData.username,
				email: userData.email,
				name: userData.name,
				avatarUrl: `https://vercel.com/api/www/avatar/?u=${userData.username}`,
				scope: undefined,
			},
		);

		if (!session) {
			return Response.redirect(
				new URL("/?error=session_creation_failed", req.url),
			);
		}

		await saveSession(session);
		return Response.redirect(new URL(redirectTo, req.url));
	} catch (error) {
		console.error("Vercel OAuth error:", error);
		return Response.redirect(new URL("/?error=oauth_error", req.url));
	} finally {
		// Clean up cookies
		const cookiesToDelete = [
			"vercel_oauth_state",
			"vercel_oauth_redirect_to",
			"vercel_oauth_code_verifier",
		];

		for (const cookieName of cookiesToDelete) {
			store.delete(cookieName);
		}
	}
}
