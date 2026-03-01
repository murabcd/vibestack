import { Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import { logger } from "@/lib/logging/logger";
import type { DataPart } from "../messages/data-parts";
import description from "./get-sandbox-url.md";
import { getSandboxCredentials } from "./sandbox-env";
import type { ToolContext } from "./types";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	context?: ToolContext;
}

export const getSandboxURL = ({ writer, context }: Params) =>
	tool({
		description,
		inputSchema: z.object({
			sandboxId: z
				.string()
				.describe(
					"The unique identifier of the Vercel Sandbox (e.g., 'sbx_abc123xyz'). This ID is returned when creating a Vercel Sandbox and is used to reference the specific sandbox instance.",
				),
			port: z
				.number()
				.int()
				.min(1)
				.max(65535)
				.describe(
					"The port number where a service is running inside the Vercel Sandbox (e.g., 3000 for Next.js dev server, 8000 for Python apps, 5000 for Flask). The port must have been exposed when the sandbox was created or when running commands.",
				),
		}),
		execute: async ({ sandboxId, port }, { toolCallId }) => {
			if (context?.canUseTool && !context.canUseTool("getSandboxURL")) {
				const message =
					"Get preview URL is temporarily paused due to repeated failures in this run.";
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Getting preview URL",
						taskNameComplete: "Preview ready",
						status: "error",
						parts: [
							{
								type: "get-sandbox-url-failed",
								error: { message },
							},
						],
					},
				});
				return { url: "" };
			}

			writer.write({
				id: toolCallId,
				type: "data-task-coding-v1",
				data: {
					taskNameActive: "Getting preview URL",
					taskNameComplete: "Preview ready",
					status: "loading",
					parts: [{ type: "get-sandbox-url-started", sandboxId, port }],
				},
			});

			let url = "";
			try {
				const { teamId, projectId, token } = getSandboxCredentials();
				const sandbox = await Sandbox.get({
					sandboxId,
					teamId,
					projectId,
					token,
				});
				url = sandbox.domain(port);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to get preview URL";
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Getting preview URL",
						taskNameComplete: "Preview ready",
						status: "error",
						parts: [
							{
								type: "get-sandbox-url-failed",
								error: { message },
							},
						],
					},
				});
				context?.recordToolOutcome?.("getSandboxURL", "failure");
				return { url: "" };
			}

			writer.write({
				id: toolCallId,
				type: "data-task-coding-v1",
				data: {
					taskNameActive: "Getting preview URL",
					taskNameComplete: "Preview ready",
					status: "done",
					parts: [{ type: "get-sandbox-url-complete", url, sandboxId, port }],
				},
			});
			context?.recordToolOutcome?.("getSandboxURL", "success");

			// Update project with sandbox URLs
			if (context?.projectId) {
				try {
					await context.updateProject({
						sandboxUrl: url,
						previewUrl: url,
					});
				} catch (error) {
					logger.error({
						event: "sandbox.url.project_update.failed",
						project_id: context.projectId,
						sandbox_id: sandboxId,
						port,
						error:
							error instanceof Error
								? { name: error.name, message: error.message }
								: { message: String(error) },
					});
				}
			}

			return { url };
		},
	});
