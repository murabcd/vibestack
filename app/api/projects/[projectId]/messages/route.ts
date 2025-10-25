import { NextResponse } from "next/server";
import { createMessage, getMessagesByProjectId } from "@/lib/db/queries";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	try {
		const { projectId } = await params;
		const messages = await getMessagesByProjectId(projectId);
		return NextResponse.json({ messages });
	} catch (error) {
		console.error("Failed to fetch messages:", error);
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
	try {
		const { projectId } = await params;
		const body = await request.json();
		const { role, content } = body;

		if (!role || !content) {
			return NextResponse.json(
				{ error: "Role and content are required" },
				{ status: 400 },
			);
		}

		if (!["user", "assistant"].includes(role)) {
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

		return NextResponse.json({ message });
	} catch (error) {
		console.error("Failed to create message:", error);
		return NextResponse.json(
			{ error: "Failed to create message" },
			{ status: 500 },
		);
	}
}
