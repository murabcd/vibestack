import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v3";
import { rejectBotRequest } from "@/lib/botid/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../_auth";

const ControlBodySchema = z.object({
	action: z.enum(["start_dev_server", "stop_dev_server", "restart_dev_server"]),
});

const STOP_DEV_SERVER_SCRIPT =
	'pkill -f "next dev|vite|webpack-dev-server|react-scripts start|bun run dev|npm run dev|pnpm dev|yarn dev" || true';

const START_DEV_SERVER_SCRIPT = `
if [ -f bun.lockb ] || [ -f bun.lock ]; then
  bun run dev -- --port 3000
elif [ -f pnpm-lock.yaml ]; then
  pnpm dev -- --port 3000
elif [ -f yarn.lock ]; then
  yarn dev --port 3000
else
  npm run dev -- --port 3000
fi
`.trim();

function isSandboxGoneError(error: unknown) {
	if (!(error instanceof Error)) return false;
	const anyError = error as Error & {
		status?: number;
		statusCode?: number;
		response?: { status?: number };
	};
	return (
		anyError.status === 410 ||
		anyError.statusCode === 410 ||
		anyError.response?.status === 410 ||
		anyError.message.includes("Status code 410")
	);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ sandboxId: string }> },
) {
	const wide = createApiWideEvent(request, "sandboxes.control");

	try {
		const botResponse = await rejectBotRequest(request, wide);
		if (botResponse) {
			return botResponse;
		}

		const [{ sandboxId }, body] = await Promise.all([params, request.json()]);
		const authz = await authorizeSandboxOwner(request, sandboxId);
		if (!authz.ok) {
			wide.end(
				authz.response.status,
				"error",
				new Error("Sandbox access denied"),
			);
			return authz.response;
		}
		const parsed = ControlBodySchema.safeParse(body);

		if (!parsed.success) {
			wide.end(400, "error", new Error("Invalid sandbox control payload"));
			return NextResponse.json(
				{ error: "Invalid request body for sandbox control" },
				{ status: 400 },
			);
		}

		const config = getSandboxConfig();
		const sandbox = await Sandbox.get({
			sandboxId,
			...config,
		});

		wide.add({ sandbox_id: sandboxId, action: parsed.data.action });

		if (
			parsed.data.action === "stop_dev_server" ||
			parsed.data.action === "restart_dev_server"
		) {
			const stop = await sandbox.runCommand("sh", [
				"-lc",
				STOP_DEV_SERVER_SCRIPT,
			]);
			await Promise.all([stop.stdout(), stop.stderr()]);
		}

		if (
			parsed.data.action === "start_dev_server" ||
			parsed.data.action === "restart_dev_server"
		) {
			const started = await sandbox.runCommand({
				cmd: "sh",
				args: ["-lc", START_DEV_SERVER_SCRIPT],
				detached: true,
			});
			wide.end(200, "success");
			return NextResponse.json({
				success: true,
				cmdId: started.cmdId,
				message: "Dev server command started",
			});
		}

		wide.end(200, "success");
		return NextResponse.json({
			success: true,
			message: "Dev server stop command executed",
		});
	} catch (error) {
		if (isSandboxGoneError(error)) {
			wide.end(410, "error", error);
			return NextResponse.json(
				{
					error:
						"Sandbox is no longer available. Create or resume a sandbox first.",
					code: "sandbox_stopped",
				},
				{ status: 410 },
			);
		}
		wide.end(500, "error", error);
		return NextResponse.json(
			{ error: "Failed to control sandbox dev server" },
			{ status: 500 },
		);
	}
}
