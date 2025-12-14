import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import { getSandboxConfig } from "@/lib/sandbox/config";

interface Params {
	sandboxId: string;
	cmdId: string;
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<Params> },
) {
	const logParams = await params;
	const encoder = new TextEncoder();
	const config = getSandboxConfig();
	const sandbox = await Sandbox.get({
		...logParams,
		...config,
	});
	const command = await sandbox.getCommand(logParams.cmdId);

	return new NextResponse(
		new ReadableStream({
			async pull(controller) {
				for await (const logline of command.logs()) {
					controller.enqueue(
						encoder.encode(
							`${JSON.stringify({
								data: logline.data,
								stream: logline.stream,
								timestamp: Date.now(),
							})}\n`,
						),
					);
				}
				controller.close();
			},
		}),
		{ headers: { "Content-Type": "application/x-ndjson" } },
	);
}
