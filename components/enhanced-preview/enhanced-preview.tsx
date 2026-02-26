"use client";

import {
	CodeIcon,
	ExternalLink,
	EyeIcon,
	PanelBottom,
	Play,
	RotateCcw,
	Square,
} from "lucide-react";
import { useId, useState } from "react";
import {
	PanelGroup,
	PanelResizeHandle,
	Panel as ResizePanel,
} from "react-resizable-panels";
import { toast } from "sonner";
import { useSandboxStore } from "@/app/state";
import { CommandsLogs } from "@/components/commands-logs/commands-logs";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { Preview } from "@/components/preview/preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Props {
	className?: string;
}

export function EnhancedPreview({ className }: Props) {
	const [consoleExpanded, setConsoleExpanded] = useState(false);
	const [activeTab, setActiveTab] = useState("preview");
	const [isControllingDevServer, setIsControllingDevServer] = useState(false);
	const panelId = useId();
	const { sandboxId, status, paths, commands, url, upsertCommand, setStatus } =
		useSandboxStore();

	const controlDevServer = async (
		action: "start_dev_server" | "stop_dev_server" | "restart_dev_server",
	) => {
		if (!sandboxId || isControllingDevServer) return;
		setIsControllingDevServer(true);
		try {
			const response = await fetch(`/api/sandboxes/${sandboxId}/control`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ action }),
			});
			const json = await response.json();
			if (!response.ok) {
				toast.error(json.error || "Failed to control dev server");
				return;
			}

			if (typeof json.cmdId === "string") {
				upsertCommand({
					sandboxId,
					cmdId: json.cmdId,
					command:
						action === "restart_dev_server"
							? "restart dev server"
							: "start dev server",
					args: [],
					background: true,
				});
				setStatus("running");
			}

			if (action === "stop_dev_server") {
				toast.success("Dev server stop signal sent");
			} else if (action === "restart_dev_server") {
				toast.success("Dev server restarting");
			} else {
				toast.success("Dev server starting");
			}
		} catch {
			toast.error("Failed to control dev server");
		} finally {
			setIsControllingDevServer(false);
		}
	};

	return (
		<Panel className={className}>
			<PanelHeader className="h-10 min-h-10 text-xs gap-1 px-2">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
					<TabsList className="h-7 bg-transparent border border-border rounded-md p-0.5">
						<TabsTrigger
							value="preview"
							className="flex items-center gap-1 cursor-pointer text-xs px-2 py-1 h-6 rounded-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-accent/40 data-[state=active]:border data-[state=active]:border-border"
						>
							<EyeIcon className="size-3" />
							<span>Preview</span>
						</TabsTrigger>
						<TabsTrigger
							value="code"
							className="flex items-center gap-1 cursor-pointer text-xs px-2 py-1 h-6 rounded-sm text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-accent/40 data-[state=active]:border data-[state=active]:border-border"
						>
							<CodeIcon className="size-3" />
							<span>Code</span>
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => setConsoleExpanded(!consoleExpanded)}
					className={cn(
						"ml-2 mr-0.5 cursor-pointer h-6 px-2 text-xs rounded-sm border",
						consoleExpanded
							? "bg-accent/40 text-foreground border-border"
							: "border-transparent text-muted-foreground hover:text-foreground",
					)}
				>
					<PanelBottom className="size-3" />
					<span>Console</span>
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => controlDevServer("start_dev_server")}
					className="mr-0.5 cursor-pointer h-6 px-2 text-xs"
					disabled={!sandboxId || isControllingDevServer}
					title="Start dev server"
				>
					<Play className="size-3" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => controlDevServer("stop_dev_server")}
					className="mr-0.5 cursor-pointer h-6 px-2 text-xs"
					disabled={!sandboxId || isControllingDevServer}
					title="Stop dev server"
				>
					<Square className="size-3" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => controlDevServer("restart_dev_server")}
					className="mr-0.5 cursor-pointer h-6 px-2 text-xs"
					disabled={!sandboxId || isControllingDevServer}
					title="Restart dev server"
				>
					<RotateCcw className="size-3" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						if (url) window.open(url, "_blank", "noreferrer");
					}}
					className="mr-0.5 cursor-pointer h-6 px-2 text-xs"
					disabled={!url}
					title="Open preview in new tab"
				>
					<ExternalLink className="size-3" />
				</Button>
			</PanelHeader>

			<PanelGroup direction="vertical" className="h-[calc(100%-2rem-1px)]">
				<ResizePanel
					defaultSize={consoleExpanded ? 70 : 100}
					minSize={30}
					id={`${panelId}-main-panel`}
					order={1}
				>
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="h-full"
					>
						<TabsContent
							value="preview"
							className="h-full m-0 data-[state=active]:h-full"
						>
							<Preview
								className="h-full"
								disabled={status === "stopped"}
								url={url}
							/>
						</TabsContent>
						<TabsContent
							value="code"
							className="h-full m-0 data-[state=active]:h-full"
						>
							<FileExplorer
								className="h-full"
								disabled={status === "stopped"}
								sandboxId={sandboxId}
								paths={paths}
							/>
						</TabsContent>
					</Tabs>
				</ResizePanel>

				{consoleExpanded && (
					<>
						<PanelResizeHandle className="h-px bg-border hover:bg-accent transition-colors" />
						<ResizePanel
							defaultSize={30}
							minSize={15}
							id={`${panelId}-console-panel`}
							order={2}
						>
							<CommandsLogs className="h-full" commands={commands} />
						</ResizePanel>
					</>
				)}
			</PanelGroup>
		</Panel>
	);
}
