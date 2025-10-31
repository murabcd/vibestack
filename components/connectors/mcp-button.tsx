"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectorDialog } from "./manage-connectors";

export function McpButton() {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setShowDialog(true)}
				className="cursor-pointer"
				title="Manage MCP Servers"
			>
				<Server className="size-4" />
			</Button>
			<ConnectorDialog open={showDialog} onOpenChange={setShowDialog} />
		</>
	);
}
