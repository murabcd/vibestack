import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { getProjectById } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getOAuthToken } from "@/lib/session/get-oauth-token";
import { getSessionFromReq } from "@/lib/session/server";

const PublishBodySchema = z.object({
	repositoryName: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z0-9._-]+$/, {
			message:
				"Repository name can only include letters, numbers, dots, hyphens, and underscores",
		}),
	visibility: z.enum(["public", "private"]),
});

const LIST_FILES_SCRIPT = `
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR" || exit 1
find . -type f \\
  ! -path "./.git/*" \\
  ! -path "./node_modules/*" \\
  ! -path "./.next/*" \\
  ! -path "./.turbo/*" \\
  ! -path "./dist/*" \\
  ! -path "./build/*" \\
  ! -name ".env" \\
  ! -name ".env.local" \\
  ! -name ".env.development.local" \\
  ! -name ".env.test.local" \\
  ! -name ".env.production.local" \\
  -print | sed 's|^./||'
`.trim();

const MAX_FILES_TO_PUBLISH = 400;

type GitHubRepo = {
	name: string;
	full_name: string;
	html_url: string;
	default_branch: string;
	owner: { login: string };
};

type GitHubError = {
	message?: string;
};

async function githubRequest<T>(
	path: string,
	accessToken: string,
	init: RequestInit,
): Promise<
	{ ok: true; data: T } | { ok: false; status: number; error: string }
> {
	const response = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${accessToken}`,
			"X-GitHub-Api-Version": "2022-11-28",
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
		cache: "no-store",
	});

	const json = (await response.json().catch(() => null)) as
		| T
		| GitHubError
		| null;

	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			error:
				typeof json === "object" && json && "message" in json
					? (json.message ?? "GitHub API request failed")
					: "GitHub API request failed",
		};
	}

	return { ok: true, data: json as T };
}

async function listSandboxFiles(sandbox: Sandbox): Promise<string[]> {
	const listCommand = await sandbox.runCommand("sh", [
		"-lc",
		LIST_FILES_SCRIPT,
	]);
	const [stdout] = await Promise.all([
		listCommand.stdout(),
		listCommand.wait(),
	]);
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

async function readSandboxFileBuffer(sandbox: Sandbox, path: string) {
	const readPath = path.startsWith("/") ? path : `/${path}`;
	const stream =
		(await sandbox.readFile({ path: readPath })) ??
		(await sandbox.readFile({ path }));
	if (!stream) return null;

	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		if (typeof chunk === "string") {
			chunks.push(Buffer.from(chunk, "utf8"));
		} else {
			chunks.push(Buffer.from(chunk));
		}
	}
	return Buffer.concat(chunks);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.publish.github");
	try {
		const [session, { projectId }, body] = await Promise.all([
			getSessionFromReq(request),
			params,
			request.json(),
		]);

		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const parsed = PublishBodySchema.safeParse(body);
		if (!parsed.success) {
			wide.end(400, "error", new Error("Invalid publish payload"));
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message ?? "Invalid request body" },
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
			wide.end(400, "error", new Error("Project sandbox not found"));
			return NextResponse.json(
				{
					error:
						"Sandbox not found for this project. Generate the app first, then publish.",
				},
				{ status: 400 },
			);
		}

		const oauth = await getOAuthToken(session.user.id, "github");
		if (!oauth?.accessToken) {
			wide.end(401, "error", new Error("GitHub token not found"));
			return NextResponse.json(
				{
					error:
						"GitHub account is not connected for this user. Sign in with GitHub and try again.",
				},
				{ status: 401 },
			);
		}

		const createRepo = await githubRequest<GitHubRepo>(
			"/user/repos",
			oauth.accessToken,
			{
				method: "POST",
				body: JSON.stringify({
					name: parsed.data.repositoryName,
					private: parsed.data.visibility === "private",
					auto_init: true,
					description: `Published from VibeStack project ${project.projectId}`,
				}),
			},
		);

		if (!createRepo.ok) {
			const status = createRepo.status === 422 ? 409 : createRepo.status;
			wide.end(status, "error", new Error(createRepo.error));
			return NextResponse.json(
				{ error: createRepo.error || "Failed to create repository" },
				{ status },
			);
		}

		const repo = createRepo.data;
		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId: project.sandboxId,
			...config,
		});
		const allFilePaths = await listSandboxFiles(sandbox);
		const filePaths = allFilePaths.slice(0, MAX_FILES_TO_PUBLISH);
		const warnings: string[] = [];
		if (allFilePaths.length > MAX_FILES_TO_PUBLISH) {
			warnings.push(
				`Publishing limited to ${MAX_FILES_TO_PUBLISH} files. ${
					allFilePaths.length - MAX_FILES_TO_PUBLISH
				} files were not included.`,
			);
		}

		if (filePaths.length === 0) {
			wide.add({ repository: repo.full_name, published_files: 0 });
			wide.end(200, "success");
			return NextResponse.json({
				success: true,
				repository: {
					name: repo.name,
					fullName: repo.full_name,
					url: repo.html_url,
					visibility: parsed.data.visibility,
				},
				publishedFiles: 0,
				skippedFiles: 0,
				warnings,
			});
		}

		const ref = await githubRequest<{ object: { sha: string } }>(
			`/repos/${repo.full_name}/git/ref/heads/${repo.default_branch}`,
			oauth.accessToken,
			{ method: "GET" },
		);
		if (!ref.ok) {
			wide.end(ref.status, "error", new Error(ref.error));
			return NextResponse.json(
				{ error: ref.error || "Failed to fetch repository branch" },
				{ status: ref.status },
			);
		}

		const baseCommitSha = ref.data.object.sha;
		const baseCommit = await githubRequest<{ tree: { sha: string } }>(
			`/repos/${repo.full_name}/git/commits/${baseCommitSha}`,
			oauth.accessToken,
			{ method: "GET" },
		);
		if (!baseCommit.ok) {
			wide.end(baseCommit.status, "error", new Error(baseCommit.error));
			return NextResponse.json(
				{ error: baseCommit.error || "Failed to fetch repository commit" },
				{ status: baseCommit.status },
			);
		}

		const treeEntries: Array<{
			path: string;
			mode: "100644";
			type: "blob";
			sha: string;
		}> = [];
		let skippedFiles = 0;

		for (const filePath of filePaths) {
			const buffer = await readSandboxFileBuffer(sandbox, filePath);
			if (!buffer) {
				skippedFiles += 1;
				continue;
			}

			const blob = await githubRequest<{ sha: string }>(
				`/repos/${repo.full_name}/git/blobs`,
				oauth.accessToken,
				{
					method: "POST",
					body: JSON.stringify({
						content: buffer.toString("base64"),
						encoding: "base64",
					}),
				},
			);

			if (!blob.ok) {
				skippedFiles += 1;
				continue;
			}

			treeEntries.push({
				path: filePath,
				mode: "100644",
				type: "blob",
				sha: blob.data.sha,
			});
		}

		if (treeEntries.length > 0) {
			const tree = await githubRequest<{ sha: string }>(
				`/repos/${repo.full_name}/git/trees`,
				oauth.accessToken,
				{
					method: "POST",
					body: JSON.stringify({
						base_tree: baseCommit.data.tree.sha,
						tree: treeEntries,
					}),
				},
			);
			if (!tree.ok) {
				wide.end(tree.status, "error", new Error(tree.error));
				return NextResponse.json(
					{ error: tree.error || "Failed to create repository tree" },
					{ status: tree.status },
				);
			}

			const commit = await githubRequest<{ sha: string }>(
				`/repos/${repo.full_name}/git/commits`,
				oauth.accessToken,
				{
					method: "POST",
					body: JSON.stringify({
						message: "chore: publish app from VibeStack",
						tree: tree.data.sha,
						parents: [baseCommitSha],
					}),
				},
			);
			if (!commit.ok) {
				wide.end(commit.status, "error", new Error(commit.error));
				return NextResponse.json(
					{ error: commit.error || "Failed to create repository commit" },
					{ status: commit.status },
				);
			}

			const updateRef = await githubRequest(
				`/repos/${repo.full_name}/git/refs/heads/${repo.default_branch}`,
				oauth.accessToken,
				{
					method: "PATCH",
					body: JSON.stringify({ sha: commit.data.sha, force: false }),
				},
			);
			if (!updateRef.ok) {
				wide.end(updateRef.status, "error", new Error(updateRef.error));
				return NextResponse.json(
					{ error: updateRef.error || "Failed to update repository branch" },
					{ status: updateRef.status },
				);
			}
		}

		const publishedFiles = treeEntries.length;
		if (skippedFiles > 0) {
			warnings.push(
				`${skippedFiles} files were skipped because they could not be read or uploaded.`,
			);
		}
		wide.add({
			repository: repo.full_name,
			published_files: publishedFiles,
			skipped_files: skippedFiles,
		});
		wide.end(200, "success");

		return NextResponse.json({
			success: true,
			repository: {
				name: repo.name,
				fullName: repo.full_name,
				url: repo.html_url,
				visibility: parsed.data.visibility,
			},
			publishedFiles,
			skippedFiles,
			warnings,
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to publish project to GitHub" },
			{ status: 500 },
		);
	}
}
