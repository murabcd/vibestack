import { NextResponse } from "next/server";
import { getMessagesByProjectId } from "@/lib/db/queries";
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
