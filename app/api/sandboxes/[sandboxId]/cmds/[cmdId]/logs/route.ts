import { Sandbox } from "@vercel/sandbox";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logging/logger";
import { getSandboxConfig } from "@/lib/sandbox/config";
import { authorizeSandboxOwner } from "../../../../_auth";

interface Params {
	sandboxId: string;
	cmdId: string;
}

const MAX_LOG_LINE_CHARS = 2000;
const MAX_STREAM_BYTES = 512 * 1024; // 512KB safety cap per request

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<Params> },
) {
	const logParams = await params;
	const authz = await authorizeSandboxOwner(_request, logParams.sandboxId);
	if (!authz.ok) {
		return authz.response;
	}
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
				let bytesSent = 0;
				try {
					for await (const logline of command.logs()) {
						const lineData = truncateLogLine(logline.data ?? "");
						const payload = `${JSON.stringify({
							data: lineData,
							stream: logline.stream,
							timestamp: Date.now(),
						})}\n`;
						const encoded = encoder.encode(payload);
						bytesSent += encoded.byteLength;
						if (bytesSent > MAX_STREAM_BYTES) {
							const truncatedPayload = `${JSON.stringify({
								data: "[log stream truncated: payload safety cap reached]",
								stream: "stderr",
								timestamp: Date.now(),
							})}\n`;
							controller.enqueue(encoder.encode(truncatedPayload));
							logger.info({
								event: "sandbox.command.logs_stream_truncated",
								sandbox_id: logParams.sandboxId,
								cmd_id: logParams.cmdId,
								max_stream_bytes: MAX_STREAM_BYTES,
								bytes_sent: bytesSent,
							});
							break;
						}
						controller.enqueue(encoded);
					}
				} catch (error) {
					const errorPayload = `${JSON.stringify({
						data: "[log stream interrupted due to transport error]",
						stream: "stderr",
						timestamp: Date.now(),
					})}\n`;
					controller.enqueue(encoder.encode(errorPayload));
					logger.error({
						event: "sandbox.command.logs_stream_failed",
						sandbox_id: logParams.sandboxId,
						cmd_id: logParams.cmdId,
						error: error instanceof Error ? error.message : String(error),
					});
				}
				controller.close();
			},
		}),
		{
			headers: {
				"Content-Type": "application/x-ndjson",
				"Cache-Control": "no-store",
			},
		},
	);
}

function truncateLogLine(line: string): string {
	if (line.length <= MAX_LOG_LINE_CHARS) {
		return line;
	}
	return `${line.slice(0, MAX_LOG_LINE_CHARS)}...[truncated ${line.length - MAX_LOG_LINE_CHARS} chars]`;
}
