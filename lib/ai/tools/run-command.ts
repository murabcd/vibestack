import { type Command, Sandbox } from "@vercel/sandbox";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import z from "zod/v3";
import { logger } from "@/lib/logging/logger";
import type { DataPart } from "../messages/data-parts";
import { getRichError } from "./get-rich-error";
import description from "./run-command.md";
import {
	isInstallCommand,
	normalizePackageJsonForInstall,
} from "./run-command-install-preflight";
import { getSandboxCredentials } from "./sandbox-env";
import type { ToolContext } from "./types";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	context?: ToolContext;
}

const MAX_TOOL_OUTPUT_CHARS = 1200;

export const runCommand = ({ writer, context }: Params) =>
	tool({
		description,
		inputSchema: z.object({
			sandboxId: z
				.string()
				.min(1)
				.describe("The ID of the Vercel Sandbox to run the command in"),
			command: z
				.string()
				.min(1)
				.max(80)
				.describe(
					"The base command to run (e.g., 'npm', 'node', 'python', 'ls', 'cat'). Do NOT include arguments here. IMPORTANT: Each command runs independently in a fresh shell session - there is no persistent state between commands. You cannot use 'cd' to change directories for subsequent commands.",
				),
			args: z
				.array(z.string().max(200))
				.max(40)
				.optional()
				.describe(
					"Array of arguments for the command. Each argument should be a separate string (e.g., ['install', '--verbose'] for npm install --verbose, or ['src/index.js'] to run a file, or ['-la', './src'] to list files). IMPORTANT: Use relative paths (e.g., 'src/file.js') or absolute paths instead of trying to change directories with 'cd' first, since each command runs in a fresh shell session.",
				),
			sudo: z
				.boolean()
				.optional()
				.describe("Whether to run the command with sudo"),
			wait: z
				.boolean()
				.describe(
					"Whether to wait for the command to finish before returning. If true, the command will block until it completes, and you will receive its output.",
				),
		}),
		execute: async (
			{ sandboxId, command, sudo, wait, args = [] },
			{ toolCallId },
		) => {
			if (context?.canUseTool && !context.canUseTool("runCommand")) {
				const message =
					"Run command is temporarily paused due to repeated failures in this run.";
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								command,
								args,
								error: { message },
							},
						],
					},
				});
				return message;
			}

			const commandValidationError = getCommandValidationError(command);
			if (commandValidationError) {
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								command,
								args,
								error: { message: commandValidationError },
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "failure");
				return `Error: ${commandValidationError}`;
			}

			if (
				context?.isDuplicateToolInput?.("runCommand", {
					sandboxId,
					command,
					sudo,
					wait,
					args,
				})
			) {
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								command,
								args,
								error: {
									message:
										"Skipped duplicate command invocation to avoid loops.",
								},
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "failure");
				return "Skipped duplicate command invocation. Update command or proceed to the next step.";
			}

			writer.write({
				id: toolCallId,
				type: "data-task-coding-v1",
				data: {
					taskNameActive: "Running command",
					taskNameComplete: "Command completed",
					status: "loading",
					parts: [{ type: "run-command-started", sandboxId, command, args }],
				},
			});

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

				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								command,
								args,
								error: richError.error,
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "failure");

				return richError.message;
			}

			let cmd: Command | null = null;

			if (isInstallCommand(command, args)) {
				await hardenPackageJsonForInstall({
					sandbox,
					sandboxId,
					toolCallId,
					writer,
				});
			}

			try {
				cmd = await sandbox.runCommand({
					detached: true,
					cmd: command,
					args,
					sudo,
				});
			} catch (error) {
				const richError = getRichError({
					action: "run command in sandbox",
					args: { sandboxId },
					error,
				});

				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								command,
								args,
								error: richError.error,
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "failure");

				return richError.message;
			}

			writer.write({
				id: toolCallId,
				type: "data-task-coding-v1",
				data: {
					taskNameActive: "Running command",
					taskNameComplete: "Command completed",
					status: "loading",
					parts: [
						{
							type: "run-command-executing",
							sandboxId,
							commandId: cmd.cmdId,
							command,
							args,
						},
					],
				},
			});

			if (!wait) {
				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "done",
						parts: [
							{
								type: "run-command-background",
								sandboxId,
								commandId: cmd.cmdId,
								command,
								args,
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "success");

				return `The command \`${command} ${args.join(
					" ",
				)}\` has been started in the background in the sandbox with ID \`${sandboxId}\` with the commandId ${
					cmd.cmdId
				}.`;
			}

			writer.write({
				id: toolCallId,
				type: "data-task-coding-v1",
				data: {
					taskNameActive: "Running command",
					taskNameComplete: "Command completed",
					status: "loading",
					parts: [
						{
							type: "run-command-waiting",
							sandboxId,
							commandId: cmd.cmdId,
							command,
							args,
						},
					],
				},
			});

			const done = await cmd.wait();
			try {
				const [stdout, stderr] = await Promise.all([
					done.stdout(),
					done.stderr(),
				]);
				const summarizedStdout = summarizeOutput(stdout);
				const summarizedStderr = summarizeOutput(stderr);
				if (summarizedStdout.truncatedChars > 0) {
					logger.info({
						event: "tool.run_command.output_truncated",
						stream: "stdout",
						original_chars: stdout.length,
						truncated_chars: summarizedStdout.truncatedChars,
					});
				}
				if (summarizedStderr.truncatedChars > 0) {
					logger.info({
						event: "tool.run_command.output_truncated",
						stream: "stderr",
						original_chars: stderr.length,
						truncated_chars: summarizedStderr.truncatedChars,
					});
				}

				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: done.exitCode > 0 ? "error" : "done",
						parts: [
							{
								type:
									done.exitCode > 0
										? "run-command-failed"
										: "run-command-finished",
								sandboxId,
								commandId: cmd.cmdId,
								command,
								args,
								exitCode: done.exitCode,
							},
						],
					},
				});
				context?.recordToolOutcome?.(
					"runCommand",
					done.exitCode > 0 ? "failure" : "success",
				);

				return (
					`The command \`${command} ${args.join(
						" ",
					)}\` has finished with exit code ${done.exitCode}.` +
					`Stdout of the command was: \n` +
					`\`\`\`\n${summarizedStdout.text}\n\`\`\`\n` +
					`Stderr of the command was: \n` +
					`\`\`\`\n${summarizedStderr.text}\n\`\`\``
				);
			} catch (error) {
				const richError = getRichError({
					action: "wait for command to finish",
					args: { sandboxId, commandId: cmd.cmdId },
					error,
				});

				writer.write({
					id: toolCallId,
					type: "data-task-coding-v1",
					data: {
						taskNameActive: "Running command",
						taskNameComplete: "Command completed",
						status: "error",
						parts: [
							{
								type: "run-command-failed",
								sandboxId,
								commandId: cmd.cmdId,
								command,
								args,
								error: richError.error,
							},
						],
					},
				});
				context?.recordToolOutcome?.("runCommand", "failure");

				return richError.message;
			}
		},
	});

function summarizeOutput(output: string): {
	text: string;
	truncatedChars: number;
} {
	if (!output) {
		return { text: "", truncatedChars: 0 };
	}
	if (output.length <= MAX_TOOL_OUTPUT_CHARS) {
		return { text: output, truncatedChars: 0 };
	}
	const truncatedLength = output.length - MAX_TOOL_OUTPUT_CHARS;
	const headChars = Math.floor(MAX_TOOL_OUTPUT_CHARS * 0.7);
	const tailChars = MAX_TOOL_OUTPUT_CHARS - headChars;
	return {
		text: `${output.slice(
			0,
			headChars,
		)}\n...[truncated ${truncatedLength} chars]...\n${output.slice(
			output.length - tailChars,
		)}`,
		truncatedChars: truncatedLength,
	};
}

function getCommandValidationError(command: string): string | null {
	const trimmed = command.trim();
	if (!trimmed) {
		return "Command cannot be empty.";
	}
	if (/\s/.test(trimmed)) {
		return "Command must be a single executable without spaces. Put flags in args.";
	}
	if (/[|;&`$()<>]/.test(trimmed)) {
		return "Command contains unsupported shell control characters.";
	}
	return null;
}

async function hardenPackageJsonForInstall(args: {
	sandbox: Sandbox;
	sandboxId: string;
	toolCallId: string;
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
}): Promise<void> {
	const current = await readSandboxTextFile(args.sandbox, "package.json");
	if (!current) return;

	const normalized = normalizePackageJsonForInstall(current);
	if (!normalized.changed) return;

	try {
		await args.sandbox.writeFiles([
			{
				path: "package.json",
				content: Buffer.from(normalized.text, "utf8"),
			},
		]);
		logger.info({
			event: "tool.run_command.package_json_hardened",
			sandbox_id: args.sandboxId,
			changes: normalized.changes,
		});
		args.writer.write({
			id: args.toolCallId,
			type: "data-task-coding-v1",
			data: {
				taskNameActive: "Running command",
				taskNameComplete: "Command completed",
				status: "loading",
				parts: [
					{
						type: "run-command-preflight",
						sandboxId: args.sandboxId,
						changes: normalized.changes,
					},
				],
			},
		});
	} catch (error) {
		logger.error({
			event: "tool.run_command.package_json_hardening_failed",
			sandbox_id: args.sandboxId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

async function readSandboxTextFile(
	sandbox: Sandbox,
	path: string,
): Promise<string | null> {
	try {
		const stream = await sandbox.readFile({ path });
		if (!stream) return null;
		const decoder = new TextDecoder();
		let text = "";
		for await (const chunk of stream) {
			if (typeof chunk === "string") {
				text += chunk;
			} else {
				text += decoder.decode(chunk, { stream: true });
			}
		}
		return text;
	} catch {
		return null;
	}
}
