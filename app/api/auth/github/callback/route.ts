import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/safe-redirect";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { createSession, saveSession } from "@/lib/session/create";

export async function GET(req: NextRequest): Promise<Response> {
	const wide = createApiWideEvent(req, "auth.github.callback");
	const url = new URL(req.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		wide.end(302, "error", new Error(`OAuth error: ${error}`));
		return Response.redirect(new URL(`/?error=${error}`, req.url));
	}

	if (!code || !state) {
		wide.end(302, "error", new Error("Missing code or state"));
		return Response.redirect(new URL("/?error=missing_code_or_state", req.url));
	}

	const store = await cookies();
	const storedState = store.get("github_auth_state")?.value;
	const redirectTo = sanitizeRedirectPath(
		store.get("github_auth_redirect_to")?.value,
	);
	const authMode = store.get("github_auth_mode")?.value ?? "signin";
	const userId = store.get("github_oauth_user_id")?.value;

	if (!storedState || storedState !== state) {
		wide.end(302, "error", new Error("Invalid OAuth state"));
		return Response.redirect(new URL("/?error=invalid_state", req.url));
	}

	try {
		// Exchange code for access token
		const tokenResponse = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
					client_secret: process.env.GITHUB_CLIENT_SECRET || "",
					code,
					redirect_uri: `${req.nextUrl.origin}/api/auth/github/callback`,
				}),
			},
		);

		const tokenData = await tokenResponse.json();

		if (tokenData.error) {
			wide.end(
				302,
				"error",
				new Error(`Token exchange error: ${tokenData.error}`),
			);
			return Response.redirect(new URL(`/?error=${tokenData.error}`, req.url));
		}

		// Fetch user data from GitHub
		const userResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		const userData = await userResponse.json();

		if (authMode === "connect" && userId) {
			// Connect GitHub account to existing user
			// This would be implemented in a real scenario
			wide.add({ auth_mode: "connect", user_id: userId });
		} else {
			// Create new session with real GitHub user data
			const session = await createSession(
				{
					accessToken: tokenData.access_token,
					refreshToken: tokenData.refresh_token,
				},
				"github",
				{
					externalId: userData.id.toString(),
					username: userData.login,
					email: userData.email,
					name: userData.name,
					avatarUrl: userData.avatar_url,
					scope: tokenData.scope,
				},
			);

			if (!session) {
				wide.end(302, "error", new Error("Session creation failed"));
				return Response.redirect(
					new URL("/?error=session_creation_failed", req.url),
				);
			}

			await saveSession(session);
			wide.add({ auth_mode: "signin", provider_user: userData.login });
			wide.end(302, "success");
			return Response.redirect(new URL(redirectTo, req.url));
		}

		wide.end(302, "success");
		return Response.redirect(new URL(redirectTo, req.url));
	} catch (error) {
		wide.end(302, "error", error);
		return Response.redirect(new URL("/?error=oauth_error", req.url));
	} finally {
		// Clean up cookies
		const cookiesToDelete = [
			"github_auth_state",
			"github_auth_redirect_to",
			"github_auth_mode",
			"github_oauth_user_id",
		];

		for (const cookieName of cookiesToDelete) {
			store.delete(cookieName);
		}
	}
}
