import { Code, Loader2 } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";

interface MCPToolCallProps {
	toolCallId: string;
	toolName: string;
	args: unknown;
	result?: unknown;
	state: "streaming" | "input-available" | "output-available" | "error";
	error?: string;
	_isUnused?: never; // Prevent unused warnings
}

export function MCPToolCall({
	toolCallId: _toolCallId,
	toolName,
	args,
	result,
	state,
	error,
}: MCPToolCallProps) {
	const isExecuting = state === "streaming" || state === "input-available";
	const hasResult = state === "output-available" && result !== undefined;
	const hasError = state === "error" || error !== undefined;

	// Check if arguments should be displayed
	const hasArgs = () => {
		if (args === null || args === undefined) return false;
		if (typeof args === "object" && !Array.isArray(args)) {
			// For objects, only show if they have properties
			return Object.keys(args as Record<string, unknown>).length > 0;
		}
		// For arrays or primitives, always show them
		return true;
	};

	// Determine status for TaskTrigger
	const getStatus = () => {
		if (hasError) return "error";
		if (hasResult) return "done";
		if (isExecuting) return "loading";
		return "loading";
	};

	// Determine title
	const getTitle = () => {
		if (hasError) return "Error";
		if (hasResult) return "Completed";
		if (isExecuting) return "Executing";
		return "MCP Tool";
	};

	return (
		<Task defaultOpen={true}>
			<TaskTrigger
				title={getTitle()}
				icon={<Code className="size-4" />}
				status={getStatus()}
			/>
			<TaskContent>
				<TaskItem>
					<div className="text-xs font-medium mb-1">Tool: {toolName}</div>
				</TaskItem>
				{/* Only show Arguments if they exist and are not empty */}
				{hasArgs() && (
					<TaskItem>
						<div className="text-xs text-muted-foreground mb-1">Arguments:</div>
						<pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
							{JSON.stringify(args, null, 2)}
						</pre>
					</TaskItem>
				)}
				{isExecuting && !hasResult && !hasError && (
					<TaskItem>
						<div className="text-xs text-muted-foreground flex items-center gap-2">
							<Loader2 className="size-3 animate-spin" />
							Executing...
						</div>
					</TaskItem>
				)}
				{hasResult && (
					<TaskItem>
						<div className="text-xs text-muted-foreground mb-1">Result:</div>
						<pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto overflow-y-auto whitespace-pre-wrap wrap-break-word max-h-96">
							{typeof result === "string"
								? result
								: JSON.stringify(result, null, 2)}
						</pre>
					</TaskItem>
				)}
				{hasError && (
					<TaskItem>
						<div className="text-xs text-destructive mb-1">Error:</div>
						<pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
							{error || "Unknown error"}
						</pre>
					</TaskItem>
				)}
			</TaskContent>
		</Task>
	);
}
