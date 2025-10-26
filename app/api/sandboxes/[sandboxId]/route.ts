import { Sandbox } from "@vercel/sandbox";
import { APIError } from "@vercel/sandbox/dist/api-client/api-error";
import { type NextRequest, NextResponse } from "next/server";

/**
 * We must change the SDK to add data to the instance and then
 * use it to retrieve the status of the Sandbox.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const { sandboxId } = await params;
	try {
		const sandbox = await Sandbox.get({
			sandboxId,
			teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
			projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
			token: process.env.SANDBOX_VERCEL_TOKEN!,
		});
		await sandbox.runCommand({
			cmd: "echo",
			args: ["Sandbox status check"],
		});
		return NextResponse.json({ status: "running" });
	} catch (error) {
		if (
			error instanceof APIError &&
			error.json.error.code === "sandbox_stopped"
		) {
			return NextResponse.json({ status: "stopped" });
		} else {
			throw error;
		}
	}
}
