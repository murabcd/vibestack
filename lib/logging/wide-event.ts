import type { NextRequest } from "next/server";
import { logger } from "./logger";

type Outcome = "success" | "error";

function getRequestPath(request: Request | NextRequest): string {
	if ("nextUrl" in request) {
		return request.nextUrl.pathname;
	}
	try {
		return new URL(request.url).pathname;
	} catch {
		return "";
	}
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return {
			type: error.name,
			message: error.message,
		};
	}
	return {
		type: "UnknownError",
		message: String(error),
	};
}

export function createApiWideEvent(
	request: Request | NextRequest,
	operation: string,
) {
	const startedAt = Date.now();
	const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
	const event: Record<string, unknown> = {
		event: "api.request",
		operation,
		request_id: requestId,
		method: request.method,
		path: getRequestPath(request),
		service: process.env.SERVICE_NAME ?? "vibestack-web",
		env: process.env.NODE_ENV ?? "development",
		region: process.env.VERCEL_REGION ?? "unknown",
		commit_hash: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
		version: process.env.npm_package_version ?? "unknown",
		timestamp: new Date().toISOString(),
	};

	let emitted = false;

	const add = (fields: Record<string, unknown>) => {
		Object.assign(event, fields);
	};

	const end = (
		statusCode: number,
		outcome: Outcome,
		error?: unknown,
		extra?: Record<string, unknown>,
	) => {
		if (emitted) {
			return;
		}
		emitted = true;
		if (extra) {
			Object.assign(event, extra);
		}
		event.status_code = statusCode;
		event.outcome = outcome;
		event.duration_ms = Date.now() - startedAt;
		if (error) {
			event.error = serializeError(error);
		}
		if (outcome === "error") {
			logger.error(event);
			return;
		}
		logger.info(event);
	};

	return { event, add, end };
}
