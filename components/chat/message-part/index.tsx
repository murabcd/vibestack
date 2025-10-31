import type { UIMessage } from "ai";
import { memo } from "react";
import type { DataPart } from "@/lib/ai/messages/data-parts";
import type { Metadata } from "@/lib/ai/messages/metadata";
import type { ToolSet } from "@/lib/ai/tools";
import { CreateSandbox } from "./create-sandbox";
import { GenerateFiles } from "./generate-files";
import { GetSandboxURL } from "./get-sandbox-url";
import { ImageDisplay } from "./image-display";
import { MCPToolCall } from "./mcp-tool-call";
import { Reasoning } from "./reasoning";
import { ReportErrors } from "./report-errors";
import { RunCommand } from "./run-command";
import { Text } from "./text";

interface Props {
	part: UIMessage<Metadata, DataPart, ToolSet>["parts"][number];
	partIndex: number;
	messageRole: "user" | "assistant";
}

export const MessagePart = memo(function MessagePart({
	part,
	partIndex,
	messageRole,
}: Props) {
	// Handle step-start - this is a marker for when a new step begins, we can ignore it
	if (part.type === "step-start") {
		return null;
	}

	// List of sandbox tools that should be rendered via data-* parts, not as tool-call/tool-result
	const sandboxToolNames = [
		"createSandbox",
		"runCommand",
		"getSandboxURL",
		"generateFiles",
	];

	// Helper to get tool name from part
	const getToolName = (p: Props["part"]): string | null => {
		if ("toolName" in p) return p.toolName as string;
		if ("tool-call-name" in p)
			return (p as Record<string, unknown>)["tool-call-name"] as string | null;
		return null;
	};

	// Helper to check if a tool is a sandbox tool
	const isSandboxTool = (toolName: string | null): boolean => {
		if (!toolName) return false;
		return sandboxToolNames.includes(toolName);
	};

	// Handle MCP tool calls (dynamic tools from MCP servers)
	// Only check for "dynamic-tool" type (hyphenated version)
	const isDynamicTool = part.type === "dynamic-tool";

	if (isDynamicTool) {
		const toolName = getToolName(part);

		// Skip sandbox tools - they are rendered via their data-* parts instead
		if (toolName && isSandboxTool(toolName)) {
			return null;
		}

		// For tool-call or dynamicTool with input-streaming/input-available, show the call
		if (
			"state" in part &&
			(part.state === "input-streaming" || part.state === "input-available")
		) {
			const partWithId = part as Record<string, unknown>;
			const toolCallId =
				"toolCallId" in part
					? (part.toolCallId as string)
					: "id" in part
						? (partWithId.id as string)
						: "";
			const args = "args" in part ? (part.args as unknown) : {};
			// Map input-streaming to streaming, input-available stays as input-available
			const state =
				part.state === "input-streaming" ? "streaming" : "input-available";

			return (
				<MCPToolCall
					toolCallId={toolCallId}
					toolName={toolName || "Unknown Tool"}
					args={args}
					state={state}
				/>
			);
		}
		// For dynamicTool with output, show the result
		if (
			"state" in part &&
			(part.state === "output-available" || part.state === "output-error")
		) {
			const partWithId = part as Record<string, unknown>;
			const toolCallId =
				"toolCallId" in part
					? (part.toolCallId as string)
					: "id" in part
						? (partWithId.id as string)
						: "";
			const args = "args" in part ? (part.args as unknown) : {};
			const result =
				"result" in part
					? part.result
					: "output" in part
						? part.output
						: undefined;
			// Map output-error to error, output-available stays as output-available
			const state =
				part.state === "output-error" ? "error" : "output-available";
			const error =
				"error" in part
					? typeof part.error === "string"
						? part.error
						: String(part.error)
					: part.state === "output-error"
						? "Tool execution failed"
						: undefined;

			return (
				<MCPToolCall
					toolCallId={toolCallId}
					toolName={toolName || "Unknown Tool"}
					args={args}
					result={result}
					state={state}
					error={error}
				/>
			);
		}
	}

	// Handle custom data parts
	if (part.type === "data-generating-files") {
		return <GenerateFiles message={part.data} />;
	} else if (part.type === "data-create-sandbox") {
		return <CreateSandbox message={part.data} />;
	} else if (part.type === "data-get-sandbox-url") {
		return <GetSandboxURL message={part.data} />;
	} else if (part.type === "data-run-command") {
		return <RunCommand message={part.data} />;
	} else if (part.type === "reasoning") {
		return <Reasoning part={part} partIndex={partIndex} />;
	} else if (part.type === "data-report-errors") {
		return <ReportErrors message={part.data} />;
	} else if (part.type === "text") {
		return <Text part={part} messageRole={messageRole} />;
	} else if (part.type === "file") {
		return <ImageDisplay part={part} />;
	}

	// Log unhandled part types for debugging (especially for MCP tools)
	if (process.env.NODE_ENV === "development") {
		console.log("[MessagePart] Unhandled part type:", part.type, part);
	}

	return null;
});
