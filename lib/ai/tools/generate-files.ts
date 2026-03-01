import { Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import { isProtectedMutationPath } from "@/lib/ai/safety/protected-paths";
import type { DataPart } from "../messages/data-parts";
import { type File, getContents } from "./generate-files/get-contents";
import { getWriteFiles } from "./generate-files/get-write-files";
import description from "./generate-files.md";
import { getRichError } from "./get-rich-error";
import { getSandboxCredentials } from "./sandbox-env";
import { createCodingTaskEmitter } from "./task-state-machine";
import type { ToolContext } from "./types";

interface Params {
	modelId: string;
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	context?: ToolContext;
}

const MAX_STREAMED_PATHS = 30;

function compactPaths(paths: string[]): string[] {
	if (paths.length <= MAX_STREAMED_PATHS) {
		return paths;
	}
	const remaining = paths.length - MAX_STREAMED_PATHS;
	return [
		...paths.slice(0, MAX_STREAMED_PATHS),
		`...and ${remaining} more paths`,
	];
}

export const generateFiles = ({ writer, modelId, context }: Params) =>
	tool({
		description,
		inputSchema: z.object({
			sandboxId: z.string().min(1),
			paths: z.array(z.string().min(1).max(260)).min(1).max(120),
		}),
		execute: async ({ sandboxId, paths }, { toolCallId, messages }) => {
			const task = createCodingTaskEmitter({
				writer,
				toolCallId,
				taskNameActive: "Generating files",
				taskNameComplete: "Files generated",
			});

			const blockedPaths = paths.filter((path) =>
				isProtectedMutationPath(path),
			);
			if (blockedPaths.length > 0) {
				const message = `Protected paths cannot be modified: ${blockedPaths.join(", ")}`;
				task.error([
					{
						type: "generating-files-failed",
						error: { message },
						paths: blockedPaths,
					},
				]);
				context?.recordToolOutcome?.("generateFiles", "failure");
				return message;
			}

			if (context?.canUseTool && !context.canUseTool("generateFiles")) {
				const message =
					"Generate files is temporarily paused due to repeated failures in this run.";
				task.error([
					{
						type: "generating-files-failed",
						error: { message },
					},
				]);
				return message;
			}

			if (
				context?.isDuplicateToolInput?.("generateFiles", {
					sandboxId,
					paths,
				})
			) {
				task.error([
					{
						type: "generating-files-failed",
						error: {
							message:
								"Skipped duplicate file-generation request to avoid repeated work.",
						},
					},
				]);
				return "Skipped duplicate file generation request. Adjust file list or continue to next step.";
			}

			task.loading([{ type: "generating-files-started" }]);

			let sandbox: Sandbox | null = null;

			try {
				const { teamId, projectId, token } = getSandboxCredentials();
				sandbox = await Sandbox.get({
					sandboxId,
					teamId,
					projectId,
					token,
				});
			} catch (error) {
				const richError = getRichError({
					action: "get sandbox by id",
					args: { sandboxId },
					error,
				});

				task.error([
					{ type: "generating-files-failed", error: richError.error },
				]);
				context?.recordToolOutcome?.("generateFiles", "failure");

				return richError.message;
			}

			const writeFiles = getWriteFiles({ sandbox, task });
			const iterator = getContents({ messages, modelId, paths });
			const uploaded: File[] = [];

			try {
				for await (const chunk of iterator) {
					if (chunk.files.length > 0) {
						const error = await writeFiles(chunk);
						if (error) {
							context?.recordToolOutcome?.("generateFiles", "failure");
							return error;
						} else {
							uploaded.push(...chunk.files);
						}
					} else {
						task.loading([
							{
								type: "generating-files-progress",
								paths: compactPaths(chunk.paths),
							},
						]);
					}
				}
			} catch (error) {
				const richError = getRichError({
					action: "generate file contents",
					args: { modelId, paths },
					error,
				});

				task.error([
					{
						type: "generating-files-failed",
						error: richError.error,
						paths,
					},
				]);
				context?.recordToolOutcome?.("generateFiles", "failure");

				return richError.message;
			}

			task.done([
				{
					type: "generated-files-complete",
					paths: compactPaths(uploaded.map((file) => file.path)),
				},
			]);
			context?.recordToolOutcome?.("generateFiles", "success");

			const uploadedPaths = uploaded.map((file) => file.path);
			const previewCount = 20;
			const previewPaths = uploadedPaths.slice(0, previewCount);
			const remainingCount = Math.max(uploadedPaths.length - previewCount, 0);
			const pathsSummary = [
				...previewPaths,
				remainingCount > 0 ? `...and ${remainingCount} more` : null,
			]
				.filter((item): item is string => Boolean(item))
				.join("\n- ");

			// Keep tool output concise to avoid oversized UI payloads and browser memory pressure.
			return `Successfully generated and uploaded ${uploaded.length} files.\nGenerated paths:\n- ${pathsSummary}`;
		},
	});
