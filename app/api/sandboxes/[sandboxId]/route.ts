import { Sandbox } from "@vercel/sandbox";
import { APIError } from "@vercel/sandbox/dist/api-client/api-error";
import { type NextRequest, NextResponse } from "next/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";

/**
 * We must change the SDK to add data to the instance and then
 * use it to retrieve the status of the Sandbox.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.status");
	const { sandboxId } = await params;
	wide.add({ sandbox_id: sandboxId });
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
		wide.add({ sandbox_status: status });
		wide.end(200, "success");
		return NextResponse.json({ status });
	} catch (error) {
		if (
			error instanceof APIError &&
			error.json.error.code === "sandbox_stopped"
		) {
			wide.add({ sandbox_status: "stopped" });
			wide.end(200, "success");
			return NextResponse.json({ status: "stopped" });
		} else {
			wide.end(500, "error", error);
			throw error;
		}
	}
}
