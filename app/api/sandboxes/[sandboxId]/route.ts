import { Sandbox } from "@vercel/sandbox";
import { APIError } from "@vercel/sandbox/dist/api-client/api-error";
import { type NextRequest, NextResponse } from "next/server";
import { getSandboxConfig } from "@/lib/sandbox/config";

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
		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId,
			...config,
		});
		const status =
			sandbox.status === "stopped" || sandbox.status === "failed"
				? "stopped"
				: "running";
		return NextResponse.json({ status });
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
