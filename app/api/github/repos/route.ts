import { type NextRequest, NextResponse } from "next/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getOAuthToken } from "@/lib/session/get-oauth-token";
import { getSessionFromReq } from "@/lib/session/server";

type GitHubRepoItem = {
	id: number;
	name: string;
	full_name: string;
	private: boolean;
	html_url: string;
	updated_at: string;
	owner: {
		login: string;
		avatar_url?: string;
	};
};

type GitHubUser = {
	login: string;
};

type GitHubSearchResponse = {
	items: GitHubRepoItem[];
};

async function githubGet<T>(path: string, accessToken: string) {
	const maxAttempts = 2;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const response = await fetch(`https://api.github.com${path}`, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
			cache: "no-store",
		});

		const json = (await response.json().catch(() => null)) as
			| T
			| { message?: string }
			| null;
		if (response.ok) {
			return { ok: true as const, data: json as T };
		}

		const isRetryable = response.status >= 500 && response.status < 600;
		if (attempt < maxAttempts && isRetryable) {
			await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
			continue;
		}

		return {
			ok: false as const,
			status: response.status,
			error:
				typeof json === "object" && json && "message" in json
					? json.message || "GitHub request failed"
					: "GitHub request failed",
		};
	}

	return {
		ok: false as const,
		status: 502,
		error: "GitHub request failed",
	};
}

export async function GET(request: NextRequest) {
	const wide = createApiWideEvent(request, "github.repos.list");
	try {
		const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
		const session = await getSessionFromReq(request);
		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const oauth = await getOAuthToken(session.user.id, "github");
		if (!oauth?.accessToken) {
			wide.end(401, "error", new Error("GitHub token not found"));
			return NextResponse.json(
				{ error: "GitHub account is not connected" },
				{ status: 401 },
			);
		}

		const [viewerRes, reposRes] = await Promise.all([
			githubGet<GitHubUser>("/user", oauth.accessToken),
			query
				? githubGet<GitHubSearchResponse>(
						`/search/repositories?per_page=50&sort=updated&order=desc&q=${encodeURIComponent(
							`${query} in:name,full_name`,
						)}`,
						oauth.accessToken,
					)
				: githubGet<GitHubRepoItem[]>(
						"/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member",
						oauth.accessToken,
					),
		]);

		if (!reposRes.ok) {
			wide.end(reposRes.status, "error", new Error(reposRes.error));
			return NextResponse.json(
				{ error: reposRes.error },
				{ status: reposRes.status },
			);
		}

		const viewer = viewerRes.ok
			? viewerRes.data.login
			: session.user.name || "";
		const repoItems: GitHubRepoItem[] = query
			? (reposRes.data as GitHubSearchResponse).items
			: (reposRes.data as GitHubRepoItem[]);
		const repos = repoItems.map((repo: GitHubRepoItem) => ({
			id: repo.id,
			name: repo.name,
			fullName: repo.full_name,
			private: repo.private,
			htmlUrl: repo.html_url,
			updatedAt: repo.updated_at,
			owner: repo.owner.login,
			ownerAvatarUrl: repo.owner.avatar_url,
		}));

		const owners = Array.from(new Set(repos.map((repo) => repo.owner))).sort(
			(a, b) => {
				if (a === viewer) return -1;
				if (b === viewer) return 1;
				return a.localeCompare(b);
			},
		);

		wide.add({
			user_id: session.user.id,
			query: query || null,
			repo_count: repos.length,
			owner_count: owners.length,
		});
		wide.end(200, "success");
		return NextResponse.json({ viewer, owners, repos });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch GitHub repositories" },
			{ status: 500 },
		);
	}
}
