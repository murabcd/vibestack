"use client";

import { useMemo } from "react";
import { DiffView, DiffModeEnum } from "@git-diff-view/react";
import { generateDiffFile } from "@git-diff-view/file";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useTheme } from "next-themes";

interface DiffViewerProps {
	originalContent: string;
	newContent: string;
	filename: string;
	language: string;
}

export function DiffViewer({
	originalContent,
	newContent,
	filename,
	language,
}: DiffViewerProps) {
	const { theme } = useTheme();

	const diffFile = useMemo(() => {
		try {
			const file = generateDiffFile(
				filename,
				originalContent,
				filename,
				newContent,
				language,
				language,
			);
			if (!file) return null;
			file.initTheme(theme === "dark" ? "dark" : "light");

			// Wrap file.init() in try-catch to handle diff parsing errors
			try {
				file.init();
				file.buildSplitDiffLines();
				file.buildUnifiedDiffLines();
			} catch (initError) {
				console.error("Error initializing diff file:", initError);
				throw initError;
			}

			return file;
		} catch {
			return null;
		}
	}, [originalContent, newContent, filename, language, theme]);

	if (!diffFile) {
		// Check if contents are identical - no diff to show
		if (originalContent === newContent) {
			return (
				<div className="flex items-center justify-center h-full p-4">
					<div className="text-center">
						<p className="text-muted-foreground mb-2 text-xs md:text-sm">
							No changes detected
						</p>
						<p className="text-xs text-muted-foreground">
							The file content is identical in both versions
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="flex items-center justify-center h-full p-4">
				<div className="text-center">
					<p className="text-destructive mb-2 text-xs md:text-sm">
						Error generating diff
					</p>
					<p className="text-xs text-muted-foreground">
						Unable to generate diff for {filename}
					</p>
				</div>
			</div>
		);
	}

	try {
		return (
			<div className="git-diff-view-container w-full">
				<DiffView
					diffFile={diffFile}
					diffViewMode={DiffModeEnum.Unified}
					diffViewTheme={theme === "dark" ? "dark" : "light"}
					diffViewHighlight={true}
					diffViewWrap={true}
					diffViewFontSize={12}
				/>
			</div>
		);
	} catch (error) {
		console.error("Error rendering diff:", error);
		return (
			<div className="flex items-center justify-center py-8 md:py-12 p-4">
				<div className="text-center">
					<p className="text-destructive mb-2 text-xs md:text-sm">
						Error rendering diff
					</p>
					<p className="text-xs text-muted-foreground">
						{error instanceof Error ? error.message : "Unknown error"}
					</p>
				</div>
			</div>
		);
	}
}
