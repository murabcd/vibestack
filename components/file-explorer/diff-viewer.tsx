"use client";

import { generateDiffFile } from "@git-diff-view/file";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { useMemo } from "react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useTheme } from "next-themes";
import { hasMeaningfulDiff } from "./diff-utils";

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
	const hasChanges = hasMeaningfulDiff(originalContent, newContent);

	const diffFile = useMemo(() => {
		// Avoid parsing diffs when content is identical. Some patch generators
		// produce header-only output with no hunks, which the parser rejects.
		if (!hasChanges) return null;

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
			file.init();
			file.buildSplitDiffLines();
			file.buildUnifiedDiffLines();

			return file;
		} catch {
			return null;
		}
	}, [originalContent, newContent, filename, language, theme, hasChanges]);

	if (!diffFile) {
		// Check if contents are identical - no diff to show
		if (!hasChanges) {
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
