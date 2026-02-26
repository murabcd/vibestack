import { NextResponse } from "next/server";
import { createMessage, getMessagesByProjectId } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.messages.list");
	try {
		const { projectId } = await params;
		const messages = await getMessagesByProjectId(projectId);
		wide.add({ project_id: projectId, message_count: messages.length });
		wide.end(200, "success");
		return NextResponse.json({ messages });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch messages" },
			{ status: 500 },
		);
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.messages.create");
	try {
		const [{ projectId }, body] = await Promise.all([params, request.json()]);
		const { role, content } = body;
		wide.add({ project_id: projectId, role });

		if (!role || !content) {
			wide.end(400, "error", new Error("Missing role or content"));
			return NextResponse.json(
				{ error: "Role and content are required" },
				{ status: 400 },
			);
		}

		if (!["user", "assistant"].includes(role)) {
			wide.end(400, "error", new Error("Invalid role"));
			return NextResponse.json(
				{ error: "Role must be 'user' or 'assistant'" },
				{ status: 400 },
			);
		}

		const message = await createMessage({
			projectId,
			role,
			content,
		});

		wide.end(200, "success");
		return NextResponse.json({ message });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to create message" },
			{ status: 500 },
		);
	}
}
