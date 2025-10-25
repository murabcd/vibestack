"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTabState } from "./use-tab-state";

interface Props {
	children: ReactNode;
	tabId: string;
}

export function TabItem({ children, tabId }: Props) {
	const [activeTabId, setTabId] = useTabState();
	return (
		<li
			onClick={() => setTabId(tabId)}
			className={cn("cursor-pointer", {
				"border-b border-b-black": activeTabId === tabId,
			})}
		>
			{children}
		</li>
	);
}
