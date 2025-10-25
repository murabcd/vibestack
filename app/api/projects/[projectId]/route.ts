import { NextResponse } from "next/server";
import { deleteProject, getProjectById, updateProject } from "@/lib/db/queries";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	try {
		const { projectId } = await params;
		const project = await getProjectById(projectId);

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to fetch project:", error);
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
	try {
		const { projectId } = await params;
		const body = await request.json();
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

		const project = await updateProject(projectId, updates);

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to update project:", error);
		return NextResponse.json(
			{ error: "Failed to update project" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	try {
		const { projectId } = await params;
		const success = await deleteProject(projectId);

		if (!success) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete project:", error);
		return NextResponse.json(
			{ error: "Failed to delete project" },
			{ status: 500 },
		);
	}
}
