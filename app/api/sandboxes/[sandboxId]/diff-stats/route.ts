import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";

interface FileDiffStat {
	additions: number;
	deletions: number;
}

function isSandboxGoneError(error: unknown) {
	if (!(error instanceof Error)) return false;
	const anyError = error as Error & {
		status?: number;
		statusCode?: number;
		response?: { status?: number };
	};
	return (
		anyError.status === 410 ||
		anyError.statusCode === 410 ||
		anyError.response?.status === 410 ||
		anyError.message.includes("Status code 410")
	);
}

function parseNumstat(output: string) {
	const stats: Record<string, FileDiffStat> = {};
	for (const rawLine of output.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		const [additionsStr, deletionsStr, ...fileParts] = line.split("\t");
		if (!fileParts.length) continue;

		const filePath = fileParts.join("\t").trim();
		const additions = Number.parseInt(additionsStr, 10);
		const deletions = Number.parseInt(deletionsStr, 10);

		stats[filePath] = {
			additions: Number.isNaN(additions) ? 0 : additions,
			deletions: Number.isNaN(deletions) ? 0 : deletions,
		};
	}
	return stats;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.diff_stats");
	try {
		const { sandboxId } = await params;
		wide.add({ sandbox_id: sandboxId });

		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId,
			...config,
		});

		const trackedDiff = await sandbox.runCommand("sh", [
			"-lc",
			"git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git diff --numstat HEAD || true",
		]);

		const untrackedDiff = await sandbox.runCommand("sh", [
			"-lc",
			'git rev-parse --is-inside-work-tree >/dev/null 2>&1 && for f in $(git ls-files --others --exclude-standard); do a=$(wc -l < "$f" 2>/dev/null || echo 0); printf "%s\\t0\\t%s\\n" "$a" "$f"; done || true',
		]);

		const [trackedStdout, untrackedStdout] = await Promise.all([
			trackedDiff.stdout(),
			untrackedDiff.stdout(),
		]);

		const stats = {
			...parseNumstat(trackedStdout),
			...parseNumstat(untrackedStdout),
		};

		wide.end(200, "success");
		return NextResponse.json({ stats });
	} catch (error) {
		if (isSandboxGoneError(error)) {
			// Sandbox can expire while UI still has its id; treat as no diff data.
			wide.end(200, "success");
			return NextResponse.json({ stats: {}, sandboxStopped: true });
		}
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to get diff stats" },
			{ status: 500 },
		);
	}
}
