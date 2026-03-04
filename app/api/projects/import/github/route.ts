import { Sandbox } from "@vercel/sandbox";
import { nanoid } from "nanoid";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { createProject, updateProject } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getOAuthToken } from "@/lib/session/get-oauth-token";
import { getSessionFromReq } from "@/lib/session/server";

const ImportBodySchema = z.object({
	repository: z.string().min(1),
	visibility: z.enum(["public", "private"]).default("private"),
});

const START_DEV_SERVER_SCRIPT = `
if [ -f bun.lockb ] || [ -f bun.lock ]; then
  bun run dev -- --port 3000
elif [ -f pnpm-lock.yaml ]; then
  pnpm dev -- --port 3000
elif [ -f yarn.lock ]; then
  yarn dev --port 3000
else
  npm run dev -- --port 3000
fi
`.trim();

const LIST_FILES_SCRIPT = `
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

function shellEscape(value: string) {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function resolveGitHubRepo(repository: string) {
	const trimmed = repository.trim();

	const fullNameMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
	if (fullNameMatch) {
		return {
			owner: fullNameMatch[1],
			repo: fullNameMatch[2].replace(/\.git$/, ""),
		};
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	if (url.hostname !== "github.com") {
		return null;
	}

	const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
	if (!owner || !repo) return null;
	return { owner, repo: repo.replace(/\.git$/, "") };
}

export async function POST(request: NextRequest) {
	const wide = createApiWideEvent(request, "projects.import.github");
	let projectId: string | null = null;
	try {
		const [session, body] = await Promise.all([
			getSessionFromReq(request),
			request.json(),
		]);
		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const parsed = ImportBodySchema.safeParse(body);
		if (!parsed.success) {
			wide.end(400, "error", new Error("Invalid import payload"));
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message ?? "Invalid request body" },
				{ status: 400 },
			);
		}

		const resolved = resolveGitHubRepo(parsed.data.repository);
		if (!resolved) {
			wide.end(400, "error", new Error("Invalid GitHub repository"));
			return NextResponse.json(
				{ error: "Repository must be a GitHub URL or owner/repo" },
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

		projectId = nanoid();
		const title = resolved.repo.replace(/[-_]/g, " ").trim() || resolved.repo;
		await createProject({
			projectId,
			title,
			visibility: parsed.data.visibility,
			userId: session.user.id,
		});

		const config = getSandboxConfig();
		const sandbox = await Sandbox.create({
			...config,
			timeout: 30 * 60 * 1000,
			ports: [3000],
			env: {
				GITHUB_TOKEN_ENCODED: encodeURIComponent(oauth.accessToken),
			},
		});

		const sanitizedRemote = `https://github.com/${resolved.owner}/${resolved.repo}.git`;
		const importScript = `
set -e
ROOT_DIR="$(pwd)"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

git clone --depth=1 "https://x-access-token:\${GITHUB_TOKEN_ENCODED}@github.com/${resolved.owner}/${resolved.repo}.git" "$TMP_DIR/repo" >/dev/null 2>&1

find "$ROOT_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R "$TMP_DIR/repo"/. "$ROOT_DIR"/
cd "$ROOT_DIR"
git remote set-url origin ${shellEscape(sanitizedRemote)} >/dev/null 2>&1 || true

${LIST_FILES_SCRIPT}
`.trim();

		const importCmd = await sandbox.runCommand("sh", ["-lc", importScript]);
		const [stdout, stderr, done] = await Promise.all([
			importCmd.stdout(),
			importCmd.stderr(),
			importCmd.wait(),
		]);

		if (done.exitCode !== 0) {
			await updateProject(projectId, {
				sandboxId: sandbox.sandboxId,
				status: "error",
				progress: 100,
			});
			wide.end(500, "error", new Error("Failed to import repository"));
			return NextResponse.json(
				{ error: stderr || "Failed to import repository" },
				{ status: 500 },
			);
		}

		const paths = stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const baseBranchCmd = await sandbox.runCommand("sh", [
			"-lc",
			"git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true",
		]);
		const baseBranch = (await baseBranchCmd.stdout()).trim() || "main";

		const startCmd = await sandbox.runCommand({
			cmd: "sh",
			args: ["-lc", START_DEV_SERVER_SCRIPT],
			detached: true,
		});

		const previewUrl = sandbox.domain(3000);
		await updateProject(projectId, {
			sandboxId: sandbox.sandboxId,
			sandboxUrl: previewUrl,
			previewUrl,
			status: "completed",
			progress: 100,
			githubMetadata: {
				source: {
					provider: "github",
					owner: resolved.owner,
					repo: resolved.repo,
					fullName: `${resolved.owner}/${resolved.repo}`,
					defaultBranch: baseBranch,
					importedAt: new Date().toISOString(),
				},
			},
		});

		wide.add({
			user_id: session.user.id,
			project_id: projectId,
			sandbox_id: sandbox.sandboxId,
			imported_file_count: paths.length,
		});
		wide.end(200, "success");

		return NextResponse.json({
			success: true,
			projectId,
			title,
			repoFullName: `${resolved.owner}/${resolved.repo}`,
			sandboxId: sandbox.sandboxId,
			previewUrl,
			startCmdId: startCmd.cmdId,
			paths,
		});
	} catch (error) {
		if (projectId) {
			await updateProject(projectId, {
				status: "error",
				progress: 100,
			}).catch(() => {});
		}
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to import repository" },
			{ status: 500 },
		);
	}
}
