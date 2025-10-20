"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

export function ModeToggle() {
	const { setTheme, resolvedTheme } = useTheme();

	const toggleTheme = React.useCallback(() => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button
			variant="ghost"
			size="icon"
			className="group/toggle extend-touch-target size-8 cursor-pointer"
			onClick={toggleTheme}
			title="Toggle theme"
		>
			<Icons.sun />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
