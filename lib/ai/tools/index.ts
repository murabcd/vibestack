import type { InferUITools, UIMessage, UIMessageStreamWriter } from "ai";
import type { DataPart } from "../messages/data-parts";
import { createSandbox } from "./create-sandbox";
import { generateFiles } from "./generate-files";
import { getSandboxURL } from "./get-sandbox-url";
import { runCommand } from "./run-command";
import type { ToolContext } from "./types";

interface Params {
	modelId: string;
	writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
	context?: ToolContext;
}

export function tools({ modelId, writer, context }: Params) {
	return {
		createSandbox: createSandbox({ writer, context }),
		generateFiles: generateFiles({ writer, modelId }),
		getSandboxURL: getSandboxURL({ writer, context }),
		runCommand: runCommand({ writer }),
	};
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>;
