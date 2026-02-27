import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../_auth";

const FileParamsSchema = z.object({
	sandboxId: z.string(),
	path: z.string(),
});

const SaveFileSchema = z.object({
	path: z.string(),
	content: z.string(),
});

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
	const fileParams = FileParamsSchema.safeParse({
		path: request.nextUrl.searchParams.get("path"),
		sandboxId,
	});
	wide.add({
		sandbox_id: sandboxId,
		file_path: request.nextUrl.searchParams.get("path"),
	});

	if (fileParams.success === false) {
		wide.end(400, "error", new Error("Invalid file params"));
		return NextResponse.json(
			{ error: "Invalid parameters. You must pass a `path` as query" },
			{ status: 400 },
		);
	}

	const config = getSandboxConfig();
	const sandbox = await Sandbox.get({
		...fileParams.data,
		...config,
	});
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
			message: "File saved successfully",
		});
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}
}
