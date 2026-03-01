import { type NextRequest, NextResponse } from "next/server";
import { getLatestProjectRun, getProjectById } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSessionFromReq } from "@/lib/session/server";

interface Params {
	projectId: string;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<Params> },
) {
	const wide = createApiWideEvent(request, "projects.runs.latest");
	try {
		const { projectId } = await params;
		const session = await getSessionFromReq(request);

		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Authentication required"), {
				project_id: projectId,
			});
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const project = await getProjectById(projectId);
		if (!project || project.userId !== session.user.id) {
			wide.end(404, "error", new Error("Project not found"), {
				project_id: projectId,
				user_id: session.user.id,
			});
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const run = await getLatestProjectRun({
			projectId,
			userId: session.user.id,
		});

		wide.end(200, "success", undefined, {
			project_id: projectId,
			user_id: session.user.id,
			has_run: Boolean(run),
			run_status: run?.status ?? null,
		});
		return NextResponse.json({ run });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch latest project run" },
			{ status: 500 },
		);
	}
}
