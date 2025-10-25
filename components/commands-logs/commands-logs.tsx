"use client";

import { SquareChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Panel, PanelHeader } from "@/components/panels/panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Command } from "./types";

interface Props {
	className?: string;
	commands: Command[];
}

export function CommandsLogs(props: Props) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Read commands to mark dependency as used
		// Scroll to the bottom whenever commands change
		// (no need to compute deltas)
		void props.commands;
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [props.commands]);

	return (
		<Panel className={cn(props.className, "border-0")}>
			<PanelHeader className="border-t border-border text-xs px-2 py-0.5">
				<SquareChevronRight className="size-3 mr-1.5" />
				<span className="font-medium">Output</span>
			</PanelHeader>
			<div className="h-[calc(100%-2rem)]">
				<ScrollArea className="h-full">
					<div className="p-2 space-y-2">
						{props.commands.map((command) => {
							const date = new Date(command.startedAt).toLocaleTimeString(
								"en-US",
								{
									hour12: false,
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
								},
							);

							const line = `${command.command} ${command.args.join(" ")}`;
							const body = command.logs?.map((log) => log.data).join("") || "";
							return (
								<pre
									key={command.cmdId}
									className="whitespace-pre-wrap text-xs font-mono text-muted-foreground"
								>
									{`[${date}] ${line}\n${body}`}
								</pre>
							);
						})}
					</div>
					<div ref={bottomRef} />
				</ScrollArea>
			</div>
		</Panel>
	);
}
