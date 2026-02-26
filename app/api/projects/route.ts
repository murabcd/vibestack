import { nanoid } from "nanoid";
import { type NextRequest, NextResponse } from "next/server";
import { createProject, getProjectsList } from "@/lib/db/queries";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(request: NextRequest) {
	const wide = createApiWideEvent(request, "projects.list");
	try {
		const session = await getSessionFromReq(request);
		if (!session) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const projects = await getProjectsList(session.user.id);
		wide.add({ user_id: session.user.id, project_count: projects.length });
		wide.end(200, "success");
		return NextResponse.json({ projects });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to fetch projects" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	const wide = createApiWideEvent(request, "projects.create");
	try {
		const sessionPromise = getSessionFromReq(request);
		const bodyPromise = request.json();
		const session = await sessionPromise;
		if (!session) {
			wide.end(401, "error", new Error("Authentication required"));
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const body = await bodyPromise;
		const {
			projectId: providedProjectId,
			title,
			visibility = "private",
		} = body;

		if (!title) {
			return NextResponse.json({ error: "Title is required" }, { status: 400 });
		}

		// Use provided projectId or generate a new one
		const projectId = providedProjectId || nanoid();
		const project = await createProject({
			projectId,
			title,
			visibility,
			userId: session.user.id,
		});

		wide.add({
			user_id: session.user.id,
			project_id: projectId,
			visibility,
		});
		wide.end(200, "success");
		return NextResponse.json({ project });
	} catch (error) {
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to create project" },
			{ status: 500 },
		);
	}
}
