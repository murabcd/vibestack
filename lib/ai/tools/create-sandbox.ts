import { Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import type { DataPart } from "../messages/data-parts";
import description from "./create-sandbox.md";
import { getRichError } from "./get-rich-error";
import type { ToolContext } from "./types";
import { validateSandboxEnvironmentVariables } from "@/lib/sandbox/config";

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
				.max(3600000)
				.optional()
				.describe(
					"Maximum time in milliseconds the Vercel Sandbox will remain active before automatically shutting down. Minimum 600000ms (10 minutes), maximum 3600000ms (60 minutes). Defaults to 1800000ms (30 minutes). The sandbox will terminate all running processes when this timeout is reached.",
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
				const sandbox = await Sandbox.create({
					teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
					projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
					token: process.env.SANDBOX_VERCEL_TOKEN!,
					timeout: timeout ?? 1800000,
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
						console.error("Failed to update project with sandbox ID:", error);
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

				console.log("Error creating Sandbox:", richError.error);
				return richError.message;
			}
		},
	});
