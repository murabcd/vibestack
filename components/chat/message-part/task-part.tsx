import type { ReactNode } from "react";
import { memo } from "react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ai-elements/task";
import { MarkdownRenderer } from "@/components/markdown-renderer/markdown-renderer";
import type { ChatUIMessage } from "../types";

type TaskMessagePart = Extract<
	ChatUIMessage["parts"][number],
	{
		type: "data-task-coding-v1" | "data-report-errors";
	}
>;

type TaskViewModel = {
	title: string;
	status: "loading" | "done" | "error";
	icon: ReactNode;
	iconName?: "sandbox" | "files" | "command" | "link" | "settings" | "wrench";
	items: ReactNode[];
	hideChevron?: boolean;
	autoOpen?: boolean;
};

export const TaskPart = memo(function TaskPart({
	part,
}: {
	part: TaskMessagePart;
}) {
	const task = toTaskViewModel(part);
	if (!task) return null;

	const meaningfulItems = task.items.filter(Boolean);

	return (
		<Task defaultOpen={task.autoOpen ?? false} open={task.autoOpen}>
			<TaskTrigger
				title={task.title}
				icon={task.icon}
				iconName={task.iconName}
				status={task.status}
				hideChevron={task.hideChevron ?? meaningfulItems.length === 0}
			/>
			{meaningfulItems.length > 0 ? (
				<TaskContent>
					{meaningfulItems.map((item, index) => (
						<TaskItem key={`${part.type}-${index}`}>{item}</TaskItem>
					))}
				</TaskContent>
			) : null}
		</Task>
	);
});

function toTaskViewModel(part: TaskMessagePart): TaskViewModel {
	if (part.type === "data-report-errors") {
		return {
			title: "Diagnostics report",
			status: "error",
			icon: null,
			iconName: "settings",
			items: [<MarkdownRenderer key="summary" content={part.data.summary} />],
		};
	}

	const latestPart = part.data.parts[part.data.parts.length - 1] as
		| Record<string, unknown>
		| undefined;
	const latestError = readError(latestPart?.error);
	const latestUrl = typeof latestPart?.url === "string" ? latestPart.url : null;
	const detailItems = latestPart ? getTaskDetailItems(latestPart) : [];

	const items: ReactNode[] = [];
	items.push(...detailItems);
	if (latestError) items.push(latestError);
	if (latestUrl) {
		items.push(
			<a
				key={`sandbox-url-${latestUrl}`}
				href={latestUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-primary hover:underline"
			>
				{latestUrl}
			</a>,
		);
	}

	return {
		title: getTaskTitle(part, latestPart),
		status: part.data.status,
		icon: null,
		iconName: getCodingTaskIconName(part),
		items,
	};
}

function getTaskDetailItems(latestPart: Record<string, unknown>): ReactNode[] {
	const type = typeof latestPart.type === "string" ? latestPart.type : "";
	const items: ReactNode[] = [];

	const command = readCommand(latestPart);
	const sandboxId =
		typeof latestPart.sandboxId === "string" ? latestPart.sandboxId : null;
	const commandId =
		typeof latestPart.commandId === "string" ? latestPart.commandId : null;
	const port = typeof latestPart.port === "number" ? latestPart.port : null;
	const exitCode =
		typeof latestPart.exitCode === "number" ? latestPart.exitCode : null;
	const paths = Array.isArray(latestPart.paths)
		? latestPart.paths.filter(
				(path): path is string => typeof path === "string",
			)
		: [];
	const changes = Array.isArray(latestPart.changes)
		? latestPart.changes.filter(
				(change): change is string => typeof change === "string",
			)
		: [];

	if (command) {
		items.push(
			<div key={`${type}-command`} className="font-mono text-xs break-all">
				`{command}`
			</div>,
		);
	}

	if (sandboxId) {
		items.push(
			<div key={`${type}-sandbox`} className="font-mono text-xs break-all">
				Sandbox: `{sandboxId}`
			</div>,
		);
	}

	if (commandId) {
		items.push(
			<div key={`${type}-command-id`} className="font-mono text-xs break-all">
				Command: `{commandId}`
			</div>,
		);
	}

	if (port !== null) {
		items.push(
			<div key={`${type}-port`} className="font-mono text-xs">
				Port: `{port}`
			</div>,
		);
	}

	if (exitCode !== null) {
		items.push(
			<div key={`${type}-exit`} className="font-mono text-xs">
				Exit code: `{exitCode}`
			</div>,
		);
	}

	if (paths.length > 0) {
		items.push(
			<div key={`${type}-paths`} className="font-mono text-xs break-all">
				Paths: `{paths.join(", ")}`
			</div>,
		);
	}

	if (changes.length > 0) {
		items.push(
			<div key={`${type}-changes`} className="font-mono text-xs break-all">
				Preflight: `{changes.join(", ")}`
			</div>,
		);
	}

	return items;
}

function readCommand(part: Record<string, unknown>): string | null {
	const command = typeof part.command === "string" ? part.command : null;
	const args = Array.isArray(part.args)
		? part.args.filter((arg): arg is string => typeof arg === "string")
		: [];
	if (!command) return null;
	return [command, ...args].join(" ").trim();
}

function getTaskTitle(
	part: Exclude<TaskMessagePart, { type: "data-report-errors" }>,
	latestPart?: Record<string, unknown>,
): string {
	const commandTitle = getCommandTaskTitle(part, latestPart);
	if (commandTitle) return commandTitle;

	const semanticTitle = getSemanticTaskTitle(part, latestPart);
	if (semanticTitle) return semanticTitle;

	const normalize = (label: string) => normalizeTaskLabel(label);

	if (part.data.status === "done") {
		return normalize(
			part.data.taskNameComplete || part.data.taskNameActive || "Task complete",
		);
	}
	if (part.data.status === "error") {
		return normalize(part.data.taskNameActive || "Task failed");
	}
	return normalize(part.data.taskNameActive || "Working");
}

function getCommandTaskTitle(
	part: Exclude<TaskMessagePart, { type: "data-report-errors" }>,
	latestPart?: Record<string, unknown>,
): string | null {
	const taskName =
		`${part.data.taskNameActive ?? ""} ${part.data.taskNameComplete ?? ""}`.toLowerCase();
	const latestType =
		typeof latestPart?.type === "string" ? latestPart.type.toLowerCase() : "";
	const isRunCommandTask =
		taskName.includes("command") || latestType.includes("run-command");

	if (!isRunCommandTask || !latestPart) return null;

	const command = readCommand(latestPart);
	if (!command) {
		if (part.data.status === "done") return "Command completed";
		if (part.data.status === "error") return "Command failed";
		return "Running command";
	}

	const purpose = classifyCommandPurpose(command);
	if (purpose === "dependencies") {
		if (part.data.status === "done") return "Dependencies installed";
		if (part.data.status === "error") return "Dependency install failed";
		return "Installing dependencies";
	}
	if (purpose === "server") {
		if (part.data.status === "done") return "Server started";
		if (part.data.status === "error") return "Server start failed";
		return "Starting server";
	}
	if (purpose === "verify") {
		if (part.data.status === "done") return "Files verified";
		if (part.data.status === "error") return "File verification failed";
		return "Verifying files";
	}

	const commandPreview =
		command.length > 56 ? `${command.slice(0, 53).trimEnd()}...` : command;
	if (part.data.status === "done")
		return `Command completed: ${commandPreview}`;
	if (part.data.status === "error") return `Command failed: ${commandPreview}`;
	return `Running command: ${commandPreview}`;
}

function getSemanticTaskTitle(
	part: Exclude<TaskMessagePart, { type: "data-report-errors" }>,
	latestPart?: Record<string, unknown>,
): string | null {
	const latestType =
		typeof latestPart?.type === "string" ? latestPart.type : "";

	if (latestType.startsWith("create-sandbox-")) {
		if (part.data.status === "done") return "Sandbox created";
		if (part.data.status === "error") return "Sandbox creation failed";
		return "Creating sandbox";
	}

	if (latestType.startsWith("generating-files-")) {
		if (part.data.status === "error") return "File generation failed";
		return "Generating files";
	}

	if (latestType.startsWith("generated-files-")) {
		return "Files generated";
	}

	if (latestType.startsWith("get-sandbox-url-")) {
		if (part.data.status === "done") return "Preview URL ready";
		if (part.data.status === "error") return "Preview URL failed";
		return "Getting preview URL";
	}

	return null;
}

function classifyCommandPurpose(
	command: string,
): "dependencies" | "server" | "verify" | "generic" {
	const text = command.toLowerCase();

	const dependencyPattern =
		/\b(npm|pnpm|yarn|bun)\s+(install|add)\b|\bpip3?\s+install\b|\bpoetry\s+install\b|\buv\s+pip\s+install\b|\bcomposer\s+install\b/;
	if (dependencyPattern.test(text)) {
		return "dependencies";
	}

	const serverPattern =
		/\bpython3?\s+-m\s+http\.server\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start)\b|\bnext\s+(dev|start)\b|\bvite\b|\bwebpack\s+serve\b|\bastro\s+dev\b|\buvicorn\b|\bflask\s+run\b|\brails\s+server\b/;
	if (serverPattern.test(text)) {
		return "server";
	}

	const verifyPattern = /\b(sed|cat|head|tail|ls|find|grep|rg|wc|stat|test)\b/;
	if (verifyPattern.test(text)) {
		return "verify";
	}

	return "generic";
}

function readError(error: unknown): string | null {
	if (!error || typeof error !== "object") return null;
	const message = (error as { message?: unknown }).message;
	return typeof message === "string" ? message : null;
}

function normalizeTaskLabel(label: string): string {
	const withoutCompletedPrefix = label.replace(/^Completed\s+/i, "");

	return withoutCompletedPrefix
		.replace(/\bcreateSandbox\b/g, "Create sandbox")
		.replace(/\bgenerateFiles\b/g, "Generate files")
		.replace(/\brunCommand\b/g, "Run command")
		.replace(/\bgetSandboxURL\b/g, "Get preview URL")
		.replace(/\bCreate Sandbox\b/g, "Create sandbox")
		.replace(/\bUploaded files\b/g, "Generate files")
		.trim();
}

function getCodingTaskIconName(
	part: Extract<
		ChatUIMessage["parts"][number],
		{ type: "data-task-coding-v1" }
	>,
): TaskViewModel["iconName"] {
	const raw =
		`${part.data.taskNameActive ?? ""} ${part.data.taskNameComplete ?? ""}`.toLowerCase();
	const latestPart = part.data.parts[part.data.parts.length - 1] as
		| Record<string, unknown>
		| undefined;
	const latestType =
		typeof latestPart?.type === "string" ? latestPart.type.toLowerCase() : "";

	if (
		raw.includes("preview") ||
		raw.includes("url") ||
		latestType.includes("get-sandbox-url") ||
		latestType.includes("url")
	) {
		return "link";
	}

	if (raw.includes("sandbox") || latestType.includes("sandbox")) {
		return "sandbox";
	}
	if (raw.includes("file") || latestType.includes("file")) {
		return "files";
	}
	if (
		raw.includes("command") ||
		latestType.includes("run-command") ||
		latestType.includes("command")
	) {
		return "command";
	}
	return "wrench";
}
