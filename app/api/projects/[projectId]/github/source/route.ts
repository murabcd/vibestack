import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getSessionFromReq } from "@/lib/session/server";

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

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.github.source.get");
	try {
		const [session, { projectId }] = await Promise.all([
			getSessionFromReq(request),
			params,
		]);

		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
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
		const metadata = project.githubMetadata;
		if (!project.sandboxId) {
			if (metadata?.source?.provider === "github") {
				wide.end(200, "success");
				return NextResponse.json({
					imported: true,
					repository: {
						owner: metadata.source.owner,
						repo: metadata.source.repo,
						fullName: metadata.source.fullName,
					},
					hasChanges: false,
					baseBranch: metadata.source.defaultBranch ?? "main",
					workingBranch: metadata.workingBranch ?? null,
					lastPullRequest: metadata.lastPullRequest ?? null,
					lastSyncedAt: metadata.lastSyncedAt ?? null,
				});
			}
			wide.end(200, "success");
			return NextResponse.json({ imported: false });
		}

		const sandbox = await Sandbox.get({
			sandboxId: project.sandboxId,
			...getSandboxConfig(),
		});

		const [remoteCmd, statusCmd, baseCmd] = await Promise.all([
			sandbox.runCommand("sh", [
				"-lc",
				"git remote get-url origin 2>/dev/null || true",
			]),
			sandbox.runCommand("sh", [
				"-lc",
				"git status --porcelain 2>/dev/null || true",
			]),
			sandbox.runCommand("sh", [
				"-lc",
				"git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true",
			]),
		]);

		const [remote, status, baseBranch] = await Promise.all([
			remoteCmd.stdout(),
			statusCmd.stdout(),
			baseCmd.stdout(),
		]);

		const repo = parseGitHubRemote(remote);
		if (!repo) {
			if (metadata?.source?.provider === "github") {
				wide.end(200, "success");
				return NextResponse.json({
					imported: true,
					repository: {
						owner: metadata.source.owner,
						repo: metadata.source.repo,
						fullName: metadata.source.fullName,
					},
					hasChanges: status.trim().length > 0,
					baseBranch:
						baseBranch.trim() || metadata.source.defaultBranch || "main",
					workingBranch: metadata.workingBranch ?? null,
					lastPullRequest: metadata.lastPullRequest ?? null,
					lastSyncedAt: metadata.lastSyncedAt ?? null,
				});
			}
			wide.end(200, "success");
			return NextResponse.json({ imported: false });
		}

		wide.add({
			project_id: projectId,
			sandbox_id: project.sandboxId,
			repo: repo.fullName,
		});
		wide.end(200, "success");
		return NextResponse.json({
			imported: true,
			repository: repo,
			hasChanges: status.trim().length > 0,
			baseBranch: baseBranch.trim() || "main",
			workingBranch: metadata?.workingBranch ?? null,
			lastPullRequest: metadata?.lastPullRequest ?? null,
			lastSyncedAt: metadata?.lastSyncedAt ?? null,
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to inspect project repository" },
			{ status: 500 },
		);
	}
}
