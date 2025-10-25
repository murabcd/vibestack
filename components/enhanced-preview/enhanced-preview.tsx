"use client";

import { CodeIcon, EyeIcon, PanelBottom } from "lucide-react";
import { useState } from "react";
import {
	PanelGroup,
	PanelResizeHandle,
	Panel as ResizePanel,
} from "react-resizable-panels";
import { useSandboxStore } from "@/app/state";
import { CommandsLogs } from "@/components/commands-logs/commands-logs";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { Preview } from "@/components/preview/preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
	className?: string;
}

export function EnhancedPreview({ className }: Props) {
	const [consoleExpanded, setConsoleExpanded] = useState(false);
	const [activeTab, setActiveTab] = useState("preview");
	const { sandboxId, status, paths, commands, url } = useSandboxStore();

	return (
		<Panel className={className}>
			<PanelHeader className="text-xs px-0.5 py-0.5">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
					<TabsList className="h-7">
						<TabsTrigger
							value="preview"
							className="flex items-center gap-1 cursor-pointer text-xs px-2 py-1 h-6"
						>
							<EyeIcon className="size-3" />
							<span>Preview</span>
						</TabsTrigger>
						<TabsTrigger
							value="code"
							className="flex items-center gap-1 cursor-pointer text-xs px-2 py-1 h-6"
						>
							<CodeIcon className="size-3" />
							<span>Code</span>
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<Button
					variant={consoleExpanded ? "outline" : "ghost"}
					size="sm"
					onClick={() => setConsoleExpanded(!consoleExpanded)}
					className="ml-2 mr-0.5 cursor-pointer h-6 px-2 text-xs"
				>
					<PanelBottom className="size-3" />
					<span>Console</span>
				</Button>
			</PanelHeader>

			<PanelGroup direction="vertical" className="h-[calc(100%-2rem-1px)]">
				<ResizePanel
					defaultSize={consoleExpanded ? 70 : 100}
					minSize={30}
					id="main-panel"
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
						<PanelResizeHandle className="h-1 hover:bg-accent transition-colors" />
						<ResizePanel
							defaultSize={30}
							minSize={15}
							id="console-panel"
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
