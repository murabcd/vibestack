import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../../_auth";

interface Params {
	sandboxId: string;
	cmdId: string;
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<Params> },
) {
	const cmdParams = await params;
	const authz = await authorizeSandboxOwner(_request, cmdParams.sandboxId);
	if (!authz.ok) {
		return authz.response;
	}
	const config = getSandboxConfig();
	const sandbox = await Sandbox.get({
		...cmdParams,
		...config,
	});
	const command = await sandbox.getCommand(cmdParams.cmdId);

	/**
	 * The wait can get to fail when the Sandbox is stopped but the command
	 * was still running. In such case we return empty for finish data.
	 */
	const done = await command.wait().catch(() => null);
	return NextResponse.json({
		sandboxId: sandbox.sandboxId,
		cmdId: command.cmdId,
		startedAt: command.startedAt,
		exitCode: done?.exitCode,
	});
}
