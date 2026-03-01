import type { Sandbox } from "@vercel/sandbox";
import { getRichError } from "../get-rich-error";
import type { CodingTaskEmitter } from "../task-state-machine";
import type { File } from "./get-contents";

interface Params {
	sandbox: Sandbox;
	task: CodingTaskEmitter;
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

export function getWriteFiles({ sandbox, task }: Params) {
	return async function writeFiles(params: {
		written: string[];
		files: File[];
		paths: string[];
	}) {
		const paths = params.written.concat(params.files.map((file) => file.path));

		try {
			await sandbox.writeFiles(
				params.files.map((file) => ({
					content: Buffer.from(file.content, "utf8"),
					path: file.path,
				})),
			);
		} catch (error) {
			const richError = getRichError({
				action: "write files to sandbox",
				args: params,
				error,
			});

			task.error([
				{
					type: "generating-files-failed",
					error: richError.error,
					paths: params.paths,
				},
			]);

			return richError.message;
		}

		task.loading([
			{ type: "generated-files-uploaded", paths: compactPaths(paths) },
		]);
	};
}
