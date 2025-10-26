import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { createProject, getProjectsList } from "@/lib/db/queries";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(request: Request) {
	try {
		const session = await getSessionFromReq(request as any);
		if (!session) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const projects = await getProjectsList(session.user.id);
		return NextResponse.json({ projects });
	} catch (error) {
		console.error("Failed to fetch projects:", error);
		return NextResponse.json(
			{ error: "Failed to fetch projects" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	try {
		const session = await getSessionFromReq(request as any);
		if (!session) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		const body = await request.json();
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

		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to create project:", error);
		return NextResponse.json(
			{ error: "Failed to create project" },
			{ status: 500 },
		);
	}
}
