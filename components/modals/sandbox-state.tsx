"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { useSandboxStore } from "@/app/state";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function SandboxState() {
	const router = useRouter();
	const { sandboxId, status, setStatus, reset } = useSandboxStore();

	// Only show dialog if we have a sandboxId and status is stopped
	if (sandboxId && status === "stopped") {
		return (
			<Dialog open>
				<DialogHeader className="sr-only">
					<DialogTitle className="sr-only">
						Sandbox duration reached
					</DialogTitle>
					<DialogDescription className="sr-only">
						The Vercel Sandbox is already stopped. You can start a new session
						by clicking the button below.
					</DialogDescription>
				</DialogHeader>
				<DialogContent className="flex flex-col items-center gap-4">
					Sandbox duration has been reached
					<Button
						className="cursor-pointer"
						onClick={() => {
							reset();
							router.push("/");
						}}
					>
						Start new session
					</Button>
				</DialogContent>
			</Dialog>
		);
	}

	return sandboxId ? (
		<DirtyChecker sandboxId={sandboxId} setStatus={setStatus} />
	) : null;
}

interface DirtyCheckerProps {
	sandboxId: string;
	setStatus: (status: "running" | "stopped") => void;
}

function DirtyChecker({ sandboxId, setStatus }: DirtyCheckerProps) {
	const content = useSWR<{ status: "running" | "stopped" }>(
		`/api/sandboxes/${sandboxId}`,
		{
			refreshInterval: (data) => (data?.status === "stopped" ? 0 : 5000),
			dedupingInterval: 4000,
			revalidateOnFocus: false,
		},
	);

	useEffect(() => {
		if (content.data?.status === "stopped") {
			setStatus("stopped");
		}
	}, [setStatus, content.data?.status]);

	return null;
}
