import { Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import type { DataPart } from "../messages/data-parts";
import description from "./get-sandbox-url.md";
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
				.describe(
					"The port number where a service is running inside the Vercel Sandbox (e.g., 3000 for Next.js dev server, 8000 for Python apps, 5000 for Flask). The port must have been exposed when the sandbox was created or when running commands.",
				),
		}),
		execute: async ({ sandboxId, port }, { toolCallId }) => {
			writer.write({
				id: toolCallId,
				type: "data-get-sandbox-url",
				data: { status: "loading" },
			});

			const sandbox = await Sandbox.get({
				sandboxId,
				teamId: process.env.SANDBOX_VERCEL_TEAM_ID!,
				projectId: process.env.SANDBOX_VERCEL_PROJECT_ID!,
				token: process.env.SANDBOX_VERCEL_TOKEN!,
			});
			const url = sandbox.domain(port);

			writer.write({
				id: toolCallId,
				type: "data-get-sandbox-url",
				data: { url, status: "done" },
			});

			// Update project with sandbox URLs
			if (context?.projectId) {
				try {
					await context.updateProject({
						sandboxUrl: url,
						previewUrl: url,
					});
				} catch (error) {
					console.error("Failed to update project with sandbox URL:", error);
				}
			}

			return { url };
		},
	});
