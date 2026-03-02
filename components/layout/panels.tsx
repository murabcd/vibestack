"use client";

import {
	ResizablePanel as Panel,
	ResizablePanelGroup as PanelGroup,
	ResizableHandle as PanelResizeHandle,
} from "@/components/ui/resizable";
import { HORIZONTAL_COOKIE, VERTICAL_COOKIE } from "./sizing";

interface HProps {
	left: React.ReactNode;
	right: React.ReactNode;
	defaultLayout: number[];
}

export function Horizontal({ defaultLayout, left, right }: HProps) {
	const onLayout = (layout: Record<string, number>) => {
		const sizes = Object.values(layout);
		window.cookieStore?.set({
			name: HORIZONTAL_COOKIE,
			value: JSON.stringify(sizes),
			path: "/",
		});
	};
	return (
		<PanelGroup orientation="horizontal" onLayoutChanged={onLayout}>
			<Panel defaultSize={`${defaultLayout[0]}%`} minSize="25%" maxSize="50%">
				{left}
			</Panel>
			<PanelResizeHandle className="w-2 bg-transparent hover:bg-accent/50 transition-colors" />
			<Panel defaultSize={`${defaultLayout[1]}%`} minSize="30%">
				{right}
			</Panel>
		</PanelGroup>
	);
}

interface VProps {
	defaultLayout: number[];
	top: React.ReactNode;
	middle: React.ReactNode;
	bottom: React.ReactNode;
}

export function Vertical({ defaultLayout, top, middle, bottom }: VProps) {
	const onLayout = (layout: Record<string, number>) => {
		const sizes = Object.values(layout);
		window.cookieStore?.set({
			name: VERTICAL_COOKIE,
			value: JSON.stringify(sizes),
			path: "/",
		});
	};
	return (
		<PanelGroup orientation="vertical" onLayoutChanged={onLayout}>
			<Panel defaultSize={`${defaultLayout[0]}%`}>{top}</Panel>
			<PanelResizeHandle className="h-2 bg-transparent hover:bg-accent/50 transition-colors" />
			<Panel defaultSize={`${defaultLayout[1]}%`}>{middle}</Panel>
			<PanelResizeHandle className="h-2 bg-transparent hover:bg-accent/50 transition-colors" />
			<Panel defaultSize={`${defaultLayout[2]}%`}>{bottom}</Panel>
		</PanelGroup>
	);
}
