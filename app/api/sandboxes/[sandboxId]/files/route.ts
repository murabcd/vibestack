import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";

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
	const { sandboxId } = await params;
	const fileParams = FileParamsSchema.safeParse({
		path: request.nextUrl.searchParams.get("path"),
		sandboxId,
	});

	if (fileParams.success === false) {
		return NextResponse.json(
			{ error: "Invalid parameters. You must pass a `path` as query" },
			{ status: 400 },
		);
	}

	const sandbox = await Sandbox.get({
		...fileParams.data,
		teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
		projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
		token: process.env.SANDBOX_VERCEL_TOKEN!,
	});
	const stream = await sandbox.readFile(fileParams.data);
	if (!stream) {
		return NextResponse.json(
			{ error: "File not found in the Sandbox" },
			{ status: 404 },
		);
	}

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
	const { sandboxId } = await params;

	try {
		const body = await request.json();
		const fileData = SaveFileSchema.safeParse(body);

		if (fileData.success === false) {
			return NextResponse.json(
				{ error: "Invalid request body. You must pass `path` and `content`" },
				{ status: 400 },
			);
		}

		const sandbox = await Sandbox.get({
			sandboxId,
			teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
			projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
			token: process.env.SANDBOX_VERCEL_TOKEN!,
		});

		// Write the file to the sandbox
		await sandbox.writeFiles([
			{
				path: fileData.data.path,
				content: Buffer.from(fileData.data.content, "utf8"),
			},
		]);

		return NextResponse.json({
			success: true,
			message: "File saved successfully",
		});
	} catch (error) {
		console.error("Error saving file:", error);
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}
}
