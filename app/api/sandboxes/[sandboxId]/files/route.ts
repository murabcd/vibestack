import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { rejectBotRequest } from "@/lib/botid/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../_auth";

const FileParamsSchema = z.object({
	sandboxId: z.string(),
	path: z.string(),
});

const ListFilesParamsSchema = z.object({
	sandboxId: z.string(),
	mode: z.literal("list"),
});

const SaveFileSchema = z.object({
	path: z.string(),
	content: z.string(),
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
  ! -path "./.vercel/*" \\
  -print | sed 's|^./||'
`.trim();

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.files.read");
	const { sandboxId } = await params;
	const authz = await authorizeSandboxOwner(request, sandboxId);
	if (!authz.ok) {
		wide.end(
			authz.response.status,
			"error",
			new Error("Sandbox access denied"),
		);
		return authz.response;
	}
	const mode = request.nextUrl.searchParams.get("mode");
	const listParams = ListFilesParamsSchema.safeParse({
		mode,
		sandboxId,
	});
	const fileParams = FileParamsSchema.safeParse({
		path: request.nextUrl.searchParams.get("path"),
		sandboxId,
	});
	wide.add({
		sandbox_id: sandboxId,
		mode,
		file_path: request.nextUrl.searchParams.get("path"),
	});

	if (listParams.success === false && fileParams.success === false) {
		wide.end(400, "error", new Error("Invalid file params"));
		return NextResponse.json(
			{
				error:
					"Invalid parameters. Pass `path` to read a file, or `mode=list` to list files.",
			},
			{ status: 400 },
		);
	}

	const config = getSandboxConfig();
	const sandbox = await Sandbox.get({
		sandboxId,
		...config,
	});

	if (listParams.success) {
		const command = await sandbox.runCommand("sh", ["-lc", LIST_FILES_SCRIPT]);
		const [stdout, waitResult] = await Promise.all([
			command.stdout(),
			command.wait(),
		]);
		if (waitResult.exitCode !== 0) {
			wide.end(500, "error", new Error("Failed to list sandbox files"));
			return NextResponse.json(
				{ error: "Failed to list sandbox files" },
				{ status: 500 },
			);
		}
		const paths = stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		wide.add({ listed_paths_count: paths.length });
		wide.end(200, "success");
		return NextResponse.json({ paths });
	}

	if (!fileParams.success) {
		wide.end(400, "error", new Error("Invalid file params"));
		return NextResponse.json(
			{ error: "Invalid parameters. You must pass a `path` as query" },
			{ status: 400 },
		);
	}

	const stream = await sandbox.readFile(fileParams.data);
	if (!stream) {
		wide.end(404, "error", new Error("File not found"));
		return NextResponse.json(
			{ error: "File not found in the Sandbox" },
			{ status: 404 },
		);
	}
	wide.end(200, "success");

	return new NextResponse(
		new ReadableStream({
			async pull(controller) {
				for await (const chunk of stream) {
					controller.enqueue(chunk);
				}
				controller.close();
			},
		}),
	);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.files.write");
	try {
		const botResponse = await rejectBotRequest(request, wide);
		if (botResponse) {
			return botResponse;
		}

		const [{ sandboxId }, body] = await Promise.all([params, request.json()]);
		const authz = await authorizeSandboxOwner(request, sandboxId);
		if (!authz.ok) {
			wide.end(
				authz.response.status,
				"error",
				new Error("Sandbox access denied"),
			);
			return authz.response;
		}
		const fileData = SaveFileSchema.safeParse(body);

		if (fileData.success === false) {
			wide.end(400, "error", new Error("Invalid file payload"));
			return NextResponse.json(
				{ error: "Invalid request body. You must pass `path` and `content`" },
				{ status: 400 },
			);
		}

		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId,
			...config,
		});

		// Write the file to the sandbox
		await sandbox.writeFiles([
			{
				path: fileData.data.path,
				content: Buffer.from(fileData.data.content, "utf8"),
			},
		]);

		wide.add({ sandbox_id: sandboxId, file_path: fileData.data.path });
		wide.end(200, "success");
		return NextResponse.json({
			success: true,
			message: "File saved",
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}
}
