import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getMaxSandboxDuration, setSetting } from "@/lib/db/settings";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(req: NextRequest) {
	const session = await getSessionFromReq(req);
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const maxDuration = await getMaxSandboxDuration(session.user.id);
		return NextResponse.json({ maxSandboxDuration: maxDuration });
	} catch (error) {
		console.error("Error getting sandbox duration setting:", error);
		return NextResponse.json(
			{ error: "Failed to get setting" },
			{ status: 500 },
		);
	}
}

export async function POST(req: NextRequest) {
	const session = await getSessionFromReq(req);
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { maxSandboxDuration } = await req.json();

		if (
			typeof maxSandboxDuration !== "number" ||
			maxSandboxDuration < 15 ||
			maxSandboxDuration > 300
		) {
			return NextResponse.json(
				{ error: "Invalid duration. Must be between 15 and 300 minutes." },
				{ status: 400 },
			);
		}

		await setSetting(
			"maxSandboxDuration",
			maxSandboxDuration.toString(),
			session.user.id,
		);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error setting sandbox duration:", error);
		return NextResponse.json(
			{ error: "Failed to save setting" },
			{ status: 500 },
		);
	}
}
