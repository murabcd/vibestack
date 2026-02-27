import { type NextRequest, NextResponse } from "next/server";
import { getMessagesByProjectId, getProjectById } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.messages.list");
	try {
		const { projectId } = await params;
		const session = await getSessionFromReq(request);
		const project = await getProjectById(projectId);
		wide.add({
			project_id: projectId,
			permission: "read_project_messages",
			auth_user_id: session?.user?.id ?? null,
		});

		if (!project) {
			wide.add({ error_type: "project_not_found" });
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}
		wide.add({
			project_visibility: project.visibility,
			project_owner_id: project.userId,
			is_owner: project.userId === session?.user?.id,
		});
		if (
			project.visibility !== "public" &&
			project.userId !== session?.user?.id
		) {
			wide.add({ denial_reason: "access_denied_private_project" });
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

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
