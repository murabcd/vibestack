import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { rejectBotRequest } from "@/lib/botid/server";
import { getProjectById, updateProject } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getOAuthToken } from "@/lib/session/get-oauth-token";
import { getSessionFromReq } from "@/lib/session/server";

const SyncBodySchema = z.object({
	commitMessage: z.string().min(1).max(200).optional(),
	branchName: z.string().min(1).max(120).optional(),
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

function mapGitError(error: string) {
	const lower = error.toLowerCase();
	if (
		lower.includes("permission denied") ||
		lower.includes("403") ||
		lower.includes("access denied")
	) {
		return "GitHub permission denied. Check repository access for this account.";
	}
	if (lower.includes("non-fast-forward")) {
		return "Remote branch changed. Pull latest changes and try syncing again.";
	}
	if (lower.includes("protected branch")) {
		return "Cannot push directly due to branch protection rules.";
	}
	return "Failed to push changes to GitHub";
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.github.sync");
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

		const body = SyncBodySchema.safeParse(rawBody);
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

		const baseBranch = detectedBaseBranch.trim() || "main";
		const existingBranch = project.githubMetadata?.workingBranch?.trim();
		const branchName =
			body.data.branchName?.trim() ||
			existingBranch ||
			`vibestack/${new Date().toISOString().replace(/[:.]/g, "-")}`;
		const commitMessage =
			body.data.commitMessage?.trim() || "chore: sync changes from VibeStack";
		const gitUserName = session.user.name?.trim() || "VibeStack";
		const gitUserEmail = session.user.email?.trim() || "noreply@vibestack.app";

		const syncScript = `
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
git rev-parse HEAD
`.trim();

		const syncCmd = await sandbox.runCommand("sh", ["-lc", syncScript]);
		const [stdout, stderr, done] = await Promise.all([
			syncCmd.stdout(),
			syncCmd.stderr(),
			syncCmd.wait(),
		]);

		if (done.exitCode !== 0) {
			const message = mapGitError(stderr || stdout);
			wide.end(500, "error", new Error(message));
			return NextResponse.json(
				{ error: message, details: stderr || stdout },
				{ status: 500 },
			);
		}

		const hasChanges = !stdout.includes("__NO_CHANGES__");
		const lines = stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const commitSha =
			hasChanges && lines.length > 0 ? lines[lines.length - 1] : null;

		await updateProject(projectId, {
			githubMetadata: {
				...(project.githubMetadata ?? {}),
				source: {
					provider: "github",
					owner: repo.owner,
					repo: repo.repo,
					fullName: repo.fullName,
					defaultBranch:
						project.githubMetadata?.source?.defaultBranch || baseBranch,
					importedAt:
						project.githubMetadata?.source?.importedAt ||
						new Date().toISOString(),
				},
				workingBranch: branchName,
				lastSyncedAt: new Date().toISOString(),
			},
		});

		wide.add({
			project_id: projectId,
			sandbox_id: project.sandboxId,
			repo: repo.fullName,
			branch: branchName,
			has_changes: hasChanges,
		});
		wide.end(200, "success");

		return NextResponse.json({
			success: true,
			repository: repo,
			branchName,
			baseBranch,
			hasChanges,
			commitSha,
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to sync changes" },
			{ status: 500 },
		);
	}
}
