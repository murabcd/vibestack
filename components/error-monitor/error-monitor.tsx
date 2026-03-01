"use client";

import { useChat } from "@ai-sdk/react";
import { usePathname } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useTransition,
} from "react";
import { useCommandErrorsLogs } from "@/app/state";
import { useSettings } from "@/components/settings/use-settings";
import { useSharedChatContext } from "@/lib/chat-context";
import { getSummary } from "./get-summary";
import type { Line } from "./schemas";
import { useMonitorState } from "./state";

interface Props {
	children: React.ReactNode;
	debounceTimeMs?: number;
}

export function ErrorMonitor({ children, debounceTimeMs = 10000 }: Props) {
	const [pending, startTransition] = useTransition();
	const { cursor, scheduled, setCursor, setScheduled } = useMonitorState();
	const { errors } = useCommandErrorsLogs();
	const { fixErrors, modelId, reasoningEffort } = useSettings();
	const { chat } = useSharedChatContext();
	const { sendMessage, status: chatStatus, messages } = useChat({ chat });
	const pathname = usePathname();
	const activeProjectId = getProjectIdFromPathname(pathname);
	const submitTimeout = useRef<NodeJS.Timeout | null>(null);
	const inspectedErrors = useRef<number>(0);
	const lastReportedErrors = useRef<string[]>([]);
	const errorReportCount = useRef<Map<string, number>>(new Map());
	const lastErrorReportTime = useRef<number>(0);
	const clearSubmitTimeout = useCallback(() => {
		if (submitTimeout.current) {
			setScheduled(false);
			clearTimeout(submitTimeout.current);
			submitTimeout.current = null;
		}
	}, [setScheduled]);

	const status =
		chatStatus !== "ready" || fixErrors === false
			? "disabled"
			: pending || scheduled
				? "pending"
				: "ready";

	const handleErrors = useCallback(
		(errors: Line[], prev: Line[]) => {
			const now = Date.now();
			const timeSinceLastReport = now - lastErrorReportTime.current;

			if (timeSinceLastReport < 60000) {
				return;
			}

			const errorKeys = errors.map(
				(error) =>
					`${error.command}-${error.args.join(" ")}-${error.data.slice(0, 100)}`,
			);
			const uniqueErrorKeys = [...new Set(errorKeys)];

			const newErrors = uniqueErrorKeys.filter((key) => {
				const count = errorReportCount.current.get(key) || 0;
				return count < 1;
			});

			if (newErrors.length === 0) {
				return;
			}

			startTransition(async () => {
				if (!activeProjectId) {
					return;
				}
				const summary = await getSummary(errors, prev);
				if (summary.shouldBeFixed) {
					newErrors.forEach((key) => {
						errorReportCount.current.set(key, 1);
					});

					lastReportedErrors.current = newErrors;
					lastErrorReportTime.current = Date.now();

					sendMessage(
						{
							role: "user",
							parts: [{ type: "data-report-errors", data: summary }],
						},
						{
							body: {
								modelId,
								reasoningEffort,
								projectId: activeProjectId,
							},
						},
					);
				}
			});
		},
		[activeProjectId, modelId, reasoningEffort, sendMessage],
	);

	useEffect(() => {
		if (messages.length === 0) {
			errorReportCount.current.clear();
			lastReportedErrors.current = [];
			lastErrorReportTime.current = 0;
		}
	}, [messages.length]);

	useEffect(() => {
		if (status === "ready" && inspectedErrors.current < errors.length) {
			const prev = errors.slice(0, cursor);
			const pending = errors.slice(cursor);
			inspectedErrors.current = errors.length;
			setScheduled(true);
			clearSubmitTimeout();
			submitTimeout.current = setTimeout(() => {
				setScheduled(false);
				setCursor(errors.length);
				handleErrors(pending, prev);
			}, debounceTimeMs);
		} else if (status === "disabled") {
			clearSubmitTimeout();
		}
	}, [
		clearSubmitTimeout,
		cursor,
		errors,
		status,
		debounceTimeMs,
		handleErrors,
		setCursor,
		setScheduled,
	]);

	return <Context.Provider value={{ status }}>{children}</Context.Provider>;
}

function getProjectIdFromPathname(pathname: string): string | undefined {
	const match = pathname.match(/^\/project\/([^/]+)/);
	return match?.[1];
}

const Context = createContext<{
	status: "ready" | "pending" | "disabled";
} | null>(null);

export function useErrorMonitor() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("useErrorMonitor must be used within a ErrorMonitor");
	}
	return context;
}
