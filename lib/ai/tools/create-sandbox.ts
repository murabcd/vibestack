import { Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import { MAX_ALLOWED_SANDBOX_DURATION } from "@/lib/constants";
import { logger } from "@/lib/logging/logger";
import { validateSandboxEnvironmentVariables } from "@/lib/sandbox/config";
import type { DataPart } from "../messages/data-parts";
import description from "./create-sandbox.md";
import { getRichError } from "./get-rich-error";
import { getSandboxCredentials } from "./sandbox-env";
import { createCodingTaskEmitter } from "./task-state-machine";
import type { ToolContext } from "./types";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	context?: ToolContext;
}

export const createSandbox = ({ writer, context }: Params) =>
	tool({
		description,
		inputSchema: z.object({
			timeout: z
				.number()
				.min(600000)
				.max(MAX_ALLOWED_SANDBOX_DURATION * 60 * 1000)
				.optional()
				.describe(
					"Maximum time in milliseconds the Vercel Sandbox will remain active before automatically shutting down. Minimum 600000ms (10 minutes), maximum 2700000ms (45 minutes). Defaults to 1800000ms (30 minutes). The sandbox will terminate all running processes when this timeout is reached.",
				),
			ports: z
				.array(z.number().int().min(1).max(65535))
				.max(2)
				.optional()
				.describe(
					"Array of network ports to expose and make accessible from outside the Vercel Sandbox. These ports allow web servers, APIs, or other services running inside the Vercel Sandbox to be reached externally. Common ports include 3000 (Next.js), 8000 (Python servers), 5000 (Flask), etc.",
				),
		}),
		execute: async ({ timeout, ports }, { toolCallId }) => {
			const task = createCodingTaskEmitter({
				writer,
				toolCallId,
				taskNameActive: "Create sandbox",
				taskNameComplete: "Create sandbox",
			});

			if (context?.canUseTool && !context.canUseTool("createSandbox")) {
				const message =
					"Create sandbox is temporarily paused due to repeated failures in this run.";
				task.error([
					{
						type: "create-sandbox-failed",
						error: { message },
					},
				]);
				return message;
			}

			const canCreateSandbox =
				context?.registerSingletonToolUse?.("createSandbox") ?? true;
			if (!canCreateSandbox) {
				const existingSandboxId = context?.getActiveSandboxId?.() ?? null;
				task.done(
					existingSandboxId
						? [
								{
									type: "create-sandbox-complete",
									sandboxId: existingSandboxId,
								},
							]
						: [{ type: "create-sandbox-skipped" }],
				);
				return existingSandboxId
					? `Reusing existing sandbox with ID: ${existingSandboxId}.`
					: "Sandbox creation already attempted in this run; skipping duplicate request.";
			}

			task.loading([{ type: "create-sandbox-started" }]);

			// Validate required environment variables
			const envValidation = validateSandboxEnvironmentVariables();
			if (!envValidation.valid) {
				context?.recordToolOutcome?.("createSandbox", "failure");
				throw new Error(
					`Missing required environment variables: ${envValidation.errors.join(", ")}`,
				);
			}

			try {
				const existingSandboxId = context?.getActiveSandboxId?.();
				if (existingSandboxId) {
					const existingSandbox =
						await getSandboxIfAvailable(existingSandboxId);
					if (existingSandbox) {
						task.done([
							{
								type: "create-sandbox-complete",
								sandboxId: existingSandbox.sandboxId,
							},
						]);
						context?.setActiveSandboxId?.(existingSandbox.sandboxId);
						context?.recordToolOutcome?.("createSandbox", "success");
						return `Reusing existing sandbox with ID: ${existingSandbox.sandboxId}.`;
					}
				}

				if (context?.allowNewSandboxCreation === false) {
					const message =
						"Sandbox creation is disabled for this turn. Reuse the existing project sandbox.";
					task.error([
						{
							type: "create-sandbox-failed",
							error: { message },
						},
					]);
					context?.recordToolOutcome?.("createSandbox", "failure");
					return message;
				}

				// Use sandbox duration from context (user's UI setting) or default to 30 minutes
				let userTimeout = context?.sandboxDuration
					? context.sandboxDuration * 60 * 1000 // Convert minutes to milliseconds
					: 1800000; // Default 30 minutes (in ms)

				// Respect the timeout parameter from AI if provided (override user setting)
				if (timeout) {
					userTimeout = timeout;
				}

				// Enforce Vercel Sandbox API maximum limit (45 minutes)
				userTimeout = Math.min(
					userTimeout,
					MAX_ALLOWED_SANDBOX_DURATION * 60 * 1000,
				);
				const { teamId, projectId, token } = getSandboxCredentials();

				const sandbox = await Sandbox.create({
					teamId,
					projectId,
					token,
					timeout: userTimeout,
					ports,
				});

				task.done([
					{ type: "create-sandbox-complete", sandboxId: sandbox.sandboxId },
				]);
				context?.setActiveSandboxId?.(sandbox.sandboxId);
				context?.recordToolOutcome?.("createSandbox", "success");

				// Update project with sandbox metadata
				if (context?.projectId) {
					try {
						await context.updateProject({
							sandboxId: sandbox.sandboxId,
							status: "processing",
						});
					} catch (error) {
						logger.error({
							event: "sandbox.create.project_update.failed",
							project_id: context.projectId,
							sandbox_id: sandbox.sandboxId,
							error:
								error instanceof Error
									? { name: error.name, message: error.message }
									: { message: String(error) },
						});
					}
				}

				return (
					`Sandbox created with ID: ${sandbox.sandboxId}.` +
					`\nYou can now upload files, run commands, and access services on the exposed ports.`
				);
			} catch (error) {
				const richError = getRichError({
					action: "Creating Sandbox",
					error,
				});

				task.error([
					{
						type: "create-sandbox-failed",
						error: { message: richError.error.message },
					},
				]);
				context?.recordToolOutcome?.("createSandbox", "failure");

				logger.error({
					event: "sandbox.create.failed",
					error: {
						message: richError.error.message,
					},
				});
				return richError.message;
			}
		},
	});

async function getSandboxIfAvailable(
	sandboxId: string,
): Promise<Sandbox | null> {
	try {
		const { teamId, projectId, token } = getSandboxCredentials();
		return await Sandbox.get({
			sandboxId,
			teamId,
			projectId,
			token,
		});
	} catch {
		return null;
	}
}
