"use client";

import {
	ChevronDown,
	ChevronRight,
	Copy,
	Download,
	Pause,
	Play,
	SquareChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Command, CommandLog } from "./types";

interface Props {
	className?: string;
	commands: Command[];
}

type LogLevel = "info" | "warn" | "error";
type StreamFilter = "all" | "stdout" | "stderr";
type LevelFilter = "all" | LogLevel;

function inferLogLevel(log: CommandLog): LogLevel {
	if (log.stream === "stderr") return "error";
	const text = log.data.toLowerCase();
	if (
		text.includes("error") ||
		text.includes("exception") ||
		text.includes("failed")
	) {
		return "error";
	}
	if (text.includes("warn") || text.includes("deprecated")) {
		return "warn";
	}
	return "info";
}

function formatTime(timestamp: number) {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export function CommandsLogs(props: Props) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState("");
	const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");
	const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
	const [followTail, setFollowTail] = useState(true);
	const [collapsedCmds, setCollapsedCmds] = useState<Set<string>>(new Set());

	const grouped = useMemo(() => {
		return props.commands.map((command) => {
			const enrichedLogs = (command.logs ?? []).map((log) => ({
				...log,
				level: inferLogLevel(log),
			}));
			return {
				command,
				line: `${command.command} ${command.args.join(" ")}`.trim(),
				enrichedLogs,
			};
		});
	}, [props.commands]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return grouped
			.map((group) => {
				const logs = group.enrichedLogs.filter((log) => {
					if (streamFilter !== "all" && log.stream !== streamFilter)
						return false;
					if (levelFilter !== "all" && log.level !== levelFilter) return false;
					if (!q) return true;
					return (
						log.data.toLowerCase().includes(q) ||
						group.line.toLowerCase().includes(q)
					);
				});
				return { ...group, logs };
			})
			.filter(
				(group) =>
					group.logs.length > 0 || (!query && group.enrichedLogs.length === 0),
			);
	}, [grouped, streamFilter, levelFilter, query]);

	const exportedText = useMemo(() => {
		return filtered
			.map((group) => {
				const header = `[${formatTime(group.command.startedAt)}] ${group.line}`;
				const body = group.logs.map((log) => log.data).join("");
				return `${header}\n${body}`;
			})
			.join("\n\n");
	}, [filtered]);

	const totals = useMemo(() => {
		let info = 0;
		let warn = 0;
		let error = 0;
		for (const group of filtered) {
			for (const log of group.logs) {
				if (log.level === "error") error++;
				else if (log.level === "warn") warn++;
				else info++;
			}
		}
		return { info, warn, error };
	}, [filtered]);

	useEffect(() => {
		void props.commands;
		if (!followTail || !scrollRef.current) return;
		scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [props.commands, followTail]);

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setFollowTail(distanceFromBottom < 24);
	};

	const toggleCollapsed = (cmdId: string) => {
		setCollapsedCmds((prev) => {
			const next = new Set(prev);
			if (next.has(cmdId)) next.delete(cmdId);
			else next.add(cmdId);
			return next;
		});
	};

	const handleCopy = async () => {
		if (!exportedText) return;
		await navigator.clipboard.writeText(exportedText);
	};

	const handleDownload = () => {
		const blob = new Blob([exportedText || ""], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `vibestack-console-${Date.now()}.log`;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	return (
		<Panel className={cn(props.className, "border-0")}>
			<PanelHeader className="border-t border-border text-xs px-2 py-0.5">
				<SquareChevronRight className="size-3 mr-1.5" />
				<span className="font-medium">Output</span>
				<TooltipProvider delayDuration={120}>
					<div className="ml-auto flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setFollowTail((prev) => !prev)}
									className="h-6 px-2 text-[11px]"
								>
									{followTail ? (
										<Pause className="size-3" />
									) : (
										<Play className="size-3" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{followTail ? "Pause auto-scroll" : "Resume auto-scroll"}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCopy}
									className="h-6 px-2 text-[11px]"
								>
									<Copy className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Copy visible logs</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleDownload}
									className="h-6 px-2 text-[11px]"
								>
									<Download className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Download visible logs</TooltipContent>
						</Tooltip>
					</div>
				</TooltipProvider>
			</PanelHeader>
			<div className="h-[calc(100%-2rem)] flex flex-col">
				<div className="border-b border-border px-2 py-1.5 flex items-center gap-2 text-[11px]">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search logs..."
						className="h-7 px-2 rounded border border-input bg-background min-w-0 flex-1"
					/>
					<select
						value={streamFilter}
						onChange={(event) =>
							setStreamFilter(event.target.value as StreamFilter)
						}
						className="h-7 px-2 rounded border border-input bg-background"
					>
						<option value="all">all streams</option>
						<option value="stdout">stdout</option>
						<option value="stderr">stderr</option>
					</select>
					<select
						value={levelFilter}
						onChange={(event) =>
							setLevelFilter(event.target.value as LevelFilter)
						}
						className="h-7 px-2 rounded border border-input bg-background"
					>
						<option value="all">all levels</option>
						<option value="info">info</option>
						<option value="warn">warn</option>
						<option value="error">error</option>
					</select>
				</div>
				<div className="border-b border-border px-2 py-1 text-[11px] text-muted-foreground">
					info {totals.info} | warn {totals.warn} | error {totals.error}
				</div>
				<div
					ref={scrollRef}
					onScroll={handleScroll}
					className="flex-1 overflow-auto p-2 space-y-2"
				>
					{filtered.map((group) => {
						const collapsed = collapsedCmds.has(group.command.cmdId);
						const status =
							typeof group.command.exitCode === "number"
								? group.command.exitCode === 0
									? "done"
									: `failed (${group.command.exitCode})`
								: "running";
						return (
							<div
								key={group.command.cmdId}
								className="rounded border border-border bg-background/40"
							>
								<button
									type="button"
									onClick={() => toggleCollapsed(group.command.cmdId)}
									className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] border-b border-border/60"
								>
									{collapsed ? (
										<ChevronRight className="size-3 shrink-0" />
									) : (
										<ChevronDown className="size-3 shrink-0" />
									)}
									<span className="text-muted-foreground shrink-0">
										[{formatTime(group.command.startedAt)}]
									</span>
									<span className="font-mono truncate">{group.line}</span>
									<span className="ml-auto text-muted-foreground shrink-0">
										{status} • {group.logs.length} lines
									</span>
								</button>
								{!collapsed && (
									<div className="px-2 py-1.5">
										{group.logs.length === 0 ? (
											<div className="text-[11px] text-muted-foreground">
												no logs match current filters
											</div>
										) : (
											group.logs.map((log, index) => (
												<div
													key={`${group.command.cmdId}-${log.timestamp}-${index}`}
													className={cn(
														"text-xs font-mono whitespace-pre-wrap wrap-break-words",
														{
															"text-muted-foreground": log.level === "info",
															"text-amber-500": log.level === "warn",
															"text-red-500": log.level === "error",
														},
													)}
												>
													{log.data}
												</div>
											))
										)}
									</div>
								)}
							</div>
						);
					})}
					{filtered.length === 0 && (
						<div className="text-xs text-muted-foreground px-1 py-2">
							No logs found for current filters
						</div>
					)}
				</div>
			</div>
		</Panel>
	);
}
