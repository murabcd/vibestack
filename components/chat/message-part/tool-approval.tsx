import { CheckIcon, XIcon } from "lucide-react";
import { memo } from "react";
import {
	Confirmation,
	ConfirmationAccepted,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRejected,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import type { ChatUIMessage } from "../types";

type RunCommandToolPart = Extract<
	ChatUIMessage["parts"][number],
	{ type: "tool-runCommand" }
>;

interface Props {
	part: RunCommandToolPart;
	addToolApprovalResponse?: (payload: {
		id: string;
		approved: boolean;
		reason?: string;
	}) => void | PromiseLike<void>;
}

export const ToolApproval = memo(function ToolApproval({
	part,
	addToolApprovalResponse,
}: Props) {
	if (!part.approval) return null;
	const approvalId = part.approval.id;

	const command = formatCommand(part.input);

	return (
		<Confirmation approval={part.approval} state={part.state}>
			<ConfirmationRequest>
				<ConfirmationTitle>
					Approve destructive command execution?
				</ConfirmationTitle>
				<div className="mt-1 font-mono text-xs break-all">`{command}`</div>
				<ConfirmationActions>
					<ConfirmationAction
						variant="outline"
						onClick={() => {
							void addToolApprovalResponse?.({
								id: approvalId,
								approved: false,
								reason: "Denied by user",
							});
						}}
					>
						Reject
					</ConfirmationAction>
					<ConfirmationAction
						onClick={() => {
							void addToolApprovalResponse?.({
								id: approvalId,
								approved: true,
							});
						}}
					>
						Approve
					</ConfirmationAction>
				</ConfirmationActions>
			</ConfirmationRequest>

			<ConfirmationAccepted>
				<div className="flex items-center gap-2 text-sm">
					<CheckIcon className="size-4" />
					<span>Command approved</span>
				</div>
				<div className="mt-1 font-mono text-xs break-all">`{command}`</div>
			</ConfirmationAccepted>

			<ConfirmationRejected>
				<div className="flex items-center gap-2 text-sm">
					<XIcon className="size-4" />
					<span>Command rejected</span>
				</div>
				<div className="mt-1 font-mono text-xs break-all">`{command}`</div>
			</ConfirmationRejected>
		</Confirmation>
	);
});

function formatCommand(input: RunCommandToolPart["input"] | undefined): string {
	if (!input || typeof input !== "object") return "runCommand";
	const command =
		"command" in input && typeof input.command === "string"
			? input.command
			: "runCommand";
	const args =
		"args" in input && Array.isArray(input.args)
			? input.args.filter((arg): arg is string => typeof arg === "string")
			: [];
	return [command, ...args].join(" ").trim();
}
