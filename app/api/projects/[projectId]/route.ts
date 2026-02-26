import { NextResponse } from "next/server";
import { deleteProject, getProjectById, updateProject } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(_request, "projects.get");
	try {
		const { projectId } = await params;
		const project = await getProjectById(projectId);
		wide.add({ project_id: projectId });

		if (!project) {
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		wide.end(200, "success");
		return NextResponse.json({ project });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch project" },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.update");
	try {
		const [{ projectId }, body] = await Promise.all([params, request.json()]);
		const {
			title,
			isPinned,
			visibility,
			sandboxId,
			sandboxUrl,
			previewUrl,
			status,
			progress,
		} = body;

		const updates: {
			title?: string;
			isPinned?: boolean;
			visibility?: "public" | "private";
			sandboxId?: string;
			sandboxUrl?: string;
			previewUrl?: string;
			status?: "idle" | "processing" | "completed" | "error";
			progress?: number;
		} = {};

		if (title !== undefined) updates.title = title;
		if (isPinned !== undefined) updates.isPinned = isPinned;
		if (visibility !== undefined) updates.visibility = visibility;
		if (sandboxId !== undefined) updates.sandboxId = sandboxId;
		if (sandboxUrl !== undefined) updates.sandboxUrl = sandboxUrl;
		if (previewUrl !== undefined) updates.previewUrl = previewUrl;
		if (status !== undefined) updates.status = status;
		if (progress !== undefined) updates.progress = progress;
		wide.add({ project_id: projectId, update_keys: Object.keys(updates) });

		const project = await updateProject(projectId, updates);

		if (!project) {
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		wide.end(200, "success");
		return NextResponse.json({ project });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to update project" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.delete");
	try {
		const { projectId } = await params;
		wide.add({ project_id: projectId });
		const success = await deleteProject(projectId);

		if (!success) {
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		wide.end(200, "success");
		return NextResponse.json({ success: true });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to delete project" },
			{ status: 500 },
		);
	}
}
