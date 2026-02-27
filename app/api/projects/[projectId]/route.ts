import { Sandbox } from "@vercel/sandbox";
import { APIError } from "@vercel/sandbox/dist/api-client/api-error";
import { type NextRequest, NextResponse } from "next/server";
import {
	deleteMessagesByProjectId,
	deleteProject,
	getProjectById,
	updateProject,
} from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(_request, "projects.get");
	try {
		const { projectId } = await params;
		const session = await getSessionFromReq(_request);
		const project = await getProjectById(projectId);
		wide.add({
			project_id: projectId,
			permission: "read_project",
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
		const isOwner = project.userId === session?.user?.id;
		if (project.visibility !== "public" && !isOwner) {
			wide.add({ denial_reason: "access_denied_private_project" });
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		wide.end(200, "success");
		if (isOwner) {
			return NextResponse.json({ project });
		}
		const publicProject = {
			...project,
			sandboxId: null,
			sandboxUrl: null,
			previewUrl: null,
		};
		return NextResponse.json({ project: publicProject });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch project" },
			{ status: 500 },
		);
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.update");
	try {
		const session = await getSessionFromReq(request);
		wide.add({
			permission: "write_project",
			auth_user_id: session?.user?.id ?? null,
		});
		if (!session?.user?.id) {
			wide.add({
				error_type: "authentication_required",
				denial_reason: "missing_session",
			});
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const [{ projectId }, body] = await Promise.all([params, request.json()]);
		const existingProject = await getProjectById(projectId);
		wide.add({ project_id: projectId });
		if (!existingProject) {
			wide.add({ error_type: "project_not_found" });
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}
		wide.add({
			project_visibility: existingProject.visibility,
			project_owner_id: existingProject.userId,
			is_owner: existingProject.userId === session.user.id,
		});
		if (existingProject.userId !== session.user.id) {
			wide.add({
				error_type: "forbidden",
				denial_reason: "owner_mismatch",
			});
			wide.end(403, "error", new Error("Forbidden"));
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

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
		if (
			visibility !== undefined &&
			visibility !== "public" &&
			visibility !== "private"
		) {
			wide.add({ error_type: "invalid_visibility" });
			wide.end(400, "error", new Error("Invalid visibility"));
			return NextResponse.json(
				{ error: "Invalid visibility" },
				{ status: 400 },
			);
		}

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
	request: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const wide = createApiWideEvent(request, "projects.delete");
	try {
		const session = await getSessionFromReq(request);
		wide.add({
			permission: "delete_project",
			auth_user_id: session?.user?.id ?? null,
		});
		if (!session?.user?.id) {
			wide.add({
				error_type: "authentication_required",
				denial_reason: "missing_session",
			});
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const { projectId } = await params;
		wide.add({ project_id: projectId });
		const project = await getProjectById(projectId);

		if (!project) {
			wide.add({ error_type: "project_not_found" });
			wide.end(404, "error", new Error("Project not found"));
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}
		wide.add({
			project_visibility: project.visibility,
			project_owner_id: project.userId,
			is_owner: project.userId === session.user.id,
		});
		if (project.userId !== session.user.id) {
			wide.add({
				error_type: "forbidden",
				denial_reason: "owner_mismatch",
			});
			wide.end(403, "error", new Error("Forbidden"));
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (project.sandboxId) {
			try {
				const config = getSandboxConfig();
				const sandbox = await Sandbox.get({
					sandboxId: project.sandboxId,
					...config,
				});
				await sandbox.stop();
			} catch (error) {
				if (
					error instanceof APIError &&
					((error.json as { error?: { code?: string } } | undefined)?.error
						?.code === "sandbox_stopped" ||
						(error.json as { error?: { code?: string } } | undefined)?.error
							?.code === "sandbox_not_found")
				) {
					wide.add({ sandbox_cleanup: "already_stopped_or_missing" });
				} else {
					throw error;
				}
			}
		}

		await deleteMessagesByProjectId(projectId);
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
