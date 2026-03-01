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
		type:
			| "data-task-thinking-v1"
			| "data-task-coding-v1"
			| "data-report-errors";
	}
>;

type TaskViewModel = {
	title: string;
	status: "loading" | "done" | "error";
	icon: ReactNode;
	iconName?:
		| "thinking"
		| "sandbox"
		| "files"
		| "command"
		| "link"
		| "settings"
		| "wrench";
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
	if (shouldHideTask(task.title)) return null;

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

	if (part.type === "data-task-thinking-v1") {
		return {
			title: getTaskTitle(part),
			status: part.data.status,
			icon: null,
			iconName: "thinking",
			items: [],
			hideChevron: true,
			autoOpen: part.data.status === "loading",
		};
	}

	const latestPart = part.data.parts[part.data.parts.length - 1] as
		| Record<string, unknown>
		| undefined;
	const latestError = readError(latestPart?.error);
	const latestUrl = typeof latestPart?.url === "string" ? latestPart.url : null;

	const items: ReactNode[] = [];
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
		title: getTaskTitle(part),
		status: part.data.status,
		icon: null,
		iconName: getCodingTaskIconName(part),
		items,
	};
}

function getTaskTitle(
	part: Exclude<TaskMessagePart, { type: "data-report-errors" }>,
): string {
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

function shouldHideTask(title: string): boolean {
	const normalized = title.toLowerCase();
	return (
		normalized.includes("preview ready") ||
		normalized.includes("getting preview url") ||
		normalized.includes("get preview url")
	);
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
	if (
		raw.includes("preview") ||
		raw.includes("url") ||
		latestType.includes("url")
	) {
		return "link";
	}

	return "wrench";
}
