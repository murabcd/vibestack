"use client";

import { Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConnectorDialog } from "./manage-connectors";

export function McpButton() {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setShowDialog(true)}
						className="cursor-pointer"
					>
						<Server className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent align="end">MCP servers</TooltipContent>
			</Tooltip>
			<ConnectorDialog open={showDialog} onOpenChange={setShowDialog} />
		</>
	);
}
