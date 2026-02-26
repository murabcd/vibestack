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
				.array(z.number())
				.max(2)
				.optional()
				.describe(
					"Array of network ports to expose and make accessible from outside the Vercel Sandbox. These ports allow web servers, APIs, or other services running inside the Vercel Sandbox to be reached externally. Common ports include 3000 (Next.js), 8000 (Python servers), 5000 (Flask), etc.",
				),
		}),
		execute: async ({ timeout, ports }, { toolCallId }) => {
			writer.write({
				id: toolCallId,
				type: "data-create-sandbox",
				data: { status: "loading" },
			});

			// Validate required environment variables
			const envValidation = validateSandboxEnvironmentVariables();
			if (!envValidation.valid) {
				throw new Error(
					`Missing required environment variables: ${envValidation.errors.join(", ")}`,
				);
			}

			try {
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

				writer.write({
					id: toolCallId,
					type: "data-create-sandbox",
					data: { sandboxId: sandbox.sandboxId, status: "done" },
				});

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

				writer.write({
					id: toolCallId,
					type: "data-create-sandbox",
					data: {
						error: { message: richError.error.message },
						status: "error",
					},
				});

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
