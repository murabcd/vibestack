import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { rejectBotRequest } from "@/lib/botid/server";
import { getProjectById, updateProject } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getOAuthToken } from "@/lib/session/get-oauth-token";
import { getSessionFromReq } from "@/lib/session/server";

const CreatePrBodySchema = z.object({
	title: z.string().min(1).max(200).optional(),
	body: z.string().max(5000).optional(),
});

function parseGitHubRemote(remote: string) {
	const trimmed = remote.trim();
	const match = trimmed.match(
		/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i,
	);
	if (!match) return null;
	return {
		owner: match[1],
		repo: match[2],
		fullName: `${match[1]}/${match[2]}`,
	};
}

function shellEscape(value: string) {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function mapGitPushError(error: string) {
	const lower = error.toLowerCase();
	if (
		lower.includes("permission denied") ||
		lower.includes("403") ||
		lower.includes("access denied")
	) {
		return "GitHub permission denied. Check repository access for this account.";
	}
	if (lower.includes("non-fast-forward")) {
		return "Remote branch changed. Pull latest changes and try again.";
	}
	if (lower.includes("protected branch")) {
		return "Cannot push to this branch due to branch protection rules.";
	}
	return "Failed to push branch to GitHub";
}

function mapPullRequestError(status: number, error: string) {
	if (status === 422) {
		return "GitHub rejected the pull request. It may already exist or there are no new commits.";
	}
	if (status === 403) {
		return "GitHub permission denied when creating pull request.";
	}
	if (status === 404) {
		return "Repository not found or access was revoked.";
	}
	return error || "Failed to create pull request";
}

type PullRequestResponse = {
	html_url: string;
	number: number;
	head: { ref: string };
	base: { ref: string };
};

function isPullRequestResponse(value: unknown): value is PullRequestResponse {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<PullRequestResponse>;
	return (
		typeof candidate.html_url === "string" &&
		typeof candidate.number === "number" &&
		typeof candidate.head?.ref === "string" &&
		typeof candidate.base?.ref === "string"
	);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.github.create_pr");
	try {
		const botResponse = await rejectBotRequest(request, wide);
		if (botResponse) {
			return botResponse;
		}

		const [session, { projectId }, rawBody] = await Promise.all([
			getSessionFromReq(request),
			params,
			request.json().catch(() => ({})),
		]);

		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const body = CreatePrBodySchema.safeParse(rawBody);
		if (!body.success) {
			wide.end(400, "error", new Error("Invalid payload"));
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		const project = await getProjectById(projectId);
		if (!project) {
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}
		if (project.userId !== session.user.id) {
			wide.end(403, "error", new Error("Forbidden"));
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!project.sandboxId) {
			wide.end(400, "error", new Error("Sandbox not found"));
			return NextResponse.json(
				{ error: "Project sandbox not found" },
				{ status: 400 },
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

		const sandbox = await Sandbox.get({
			sandboxId: project.sandboxId,
			...getSandboxConfig(),
		});

		const [remoteCmd, baseCmd] = await Promise.all([
			sandbox.runCommand("sh", [
				"-lc",
				"git remote get-url origin 2>/dev/null || true",
			]),
			sandbox.runCommand("sh", [
				"-lc",
				"git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true",
			]),
		]);
		const [remote, detectedBaseBranch] = await Promise.all([
			remoteCmd.stdout(),
			baseCmd.stdout(),
		]);

		const repo = parseGitHubRemote(remote);
		if (!repo) {
			wide.end(400, "error", new Error("Imported source repository not found"));
			return NextResponse.json(
				{ error: "This project is not linked to a GitHub source repository" },
				{ status: 400 },
			);
		}
		const baseBranch =
			detectedBaseBranch.trim() ||
			project.githubMetadata?.source?.defaultBranch ||
			"main";
		const branchName =
			project.githubMetadata?.workingBranch?.trim() ||
			`vibestack/${new Date().toISOString().replace(/[:.]/g, "-")}`;
		const commitMessage = "chore: update from VibeStack";
		const gitUserName = session.user.name?.trim() || "VibeStack";
		const gitUserEmail = session.user.email?.trim() || "noreply@vibestack.app";

		const pushScript = `
set -e
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

git config user.name ${shellEscape(gitUserName)}
git config user.email ${shellEscape(gitUserEmail)}

git checkout -B ${shellEscape(branchName)}
git add -A
if git diff --cached --quiet; then
  echo "__NO_CHANGES__"
  exit 0
fi
git commit -m ${shellEscape(commitMessage)}
git -c http.extraheader="AUTHORIZATION: bearer ${oauth.accessToken}" push -u origin ${shellEscape(branchName)}
`.trim();

		const pushCmd = await sandbox.runCommand("sh", ["-lc", pushScript]);
		const [pushStdout, pushStderr, pushDone] = await Promise.all([
			pushCmd.stdout(),
			pushCmd.stderr(),
			pushCmd.wait(),
		]);

		if (pushDone.exitCode !== 0) {
			const message = mapGitPushError(pushStderr || pushStdout);
			wide.end(500, "error", new Error(message));
			return NextResponse.json(
				{
					error: message,
					details: pushStderr || pushStdout,
				},
				{ status: 500 },
			);
		}

		const prTitle =
			body.data.title?.trim() || `Update ${project.title || repo.repo}`;
		const prBody =
			body.data.body?.trim() ||
			`Automated changes from VibeStack project ${project.projectId}.`;

		const prRes = await fetch(
			`https://api.github.com/repos/${repo.fullName}/pulls`,
			{
				method: "POST",
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${oauth.accessToken}`,
					"X-GitHub-Api-Version": "2022-11-28",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: prTitle,
					body: prBody,
					head: branchName,
					base: baseBranch,
				}),
				cache: "no-store",
			},
		);

		const prJson = (await prRes.json().catch(() => null)) as
			| PullRequestResponse
			| { message?: string }
			| null;

		if (!prRes.ok) {
			const rawError =
				typeof prJson === "object" && prJson && "message" in prJson
					? (prJson.message ?? "Failed to create pull request")
					: "Failed to create pull request";
			const error = mapPullRequestError(prRes.status, rawError);
			wide.end(prRes.status, "error", new Error(error));
			return NextResponse.json({ error }, { status: prRes.status });
		}
		if (!isPullRequestResponse(prJson)) {
			wide.end(
				500,
				"error",
				new Error("GitHub returned an unexpected PR response"),
			);
			return NextResponse.json(
				{ error: "GitHub returned an unexpected pull request response" },
				{ status: 500 },
			);
		}

		await updateProject(projectId, {
			githubMetadata: {
				...(project.githubMetadata ?? {}),
				source: {
					provider: "github",
					owner: repo.owner,
					repo: repo.repo,
					fullName: repo.fullName,
					defaultBranch: baseBranch,
					importedAt:
						project.githubMetadata?.source?.importedAt ||
						new Date().toISOString(),
				},
				workingBranch: branchName,
				lastSyncedAt: new Date().toISOString(),
				lastPullRequest: {
					number: prJson.number,
					url: prJson.html_url,
					branch: branchName,
					baseBranch,
					title: prTitle,
					createdAt: new Date().toISOString(),
				},
			},
		});

		wide.add({
			project_id: projectId,
			sandbox_id: project.sandboxId,
			repo: repo.fullName,
			branch: branchName,
			base_branch: baseBranch,
			pr_number: prJson.number,
		});
		wide.end(200, "success");

		return NextResponse.json({
			success: true,
			repository: repo,
			branchName,
			baseBranch,
			pullRequest: {
				number: prJson.number,
				url: prJson.html_url,
				title: prTitle,
			},
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to create pull request" },
			{ status: 500 },
		);
	}
}
