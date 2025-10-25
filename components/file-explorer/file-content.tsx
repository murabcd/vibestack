import { memo, useEffect } from "react";
import { PulseLoader } from "react-spinners";
import useSWR from "swr";
import { useFileHistory } from "@/app/state";
import { DiffViewer } from "./diff-viewer";
import { FileEditor } from "./file-editor";
import { MonacoSyntaxHighlighter } from "./monaco-syntax-highlighter";

interface Props {
	sandboxId: string;
	path: string;
	editable?: boolean;
	showDiff?: boolean;
	onUnsavedChanges?: (hasChanges: boolean) => void;
	onSavingStateChange?: (isSaving: boolean) => void;
	onSaveSuccess?: () => void;
}

export const FileContent = memo(function FileContent({
	sandboxId,
	path,
	editable = false,
	showDiff = false,
	onUnsavedChanges,
	onSavingStateChange,
	onSaveSuccess,
}: Props) {
	const getOriginal = useFileHistory((state) => state.getOriginal);
	const captureOriginalBeforeAI = useFileHistory(
		(state) => state.captureOriginalBeforeAI,
	);
	const searchParams = new URLSearchParams({ path });
	const content = useSWR(
		`/api/sandboxes/${sandboxId}/files?${searchParams.toString()}`,
		async (pathname: string, init: RequestInit) => {
			const response = await fetch(pathname, init);
			const text = await response.text();
			return text;
		},
		{ refreshInterval: 1000 },
	);

	// Track original content when first loaded - capture before AI modifications
	useEffect(() => {
		if (content.data && sandboxId && path) {
			captureOriginalBeforeAI(sandboxId, path, content.data);
		}
	}, [content.data, sandboxId, path, captureOriginalBeforeAI]);

	if (content.isLoading || !content.data) {
		return (
			<div className="absolute w-full h-full flex items-center text-center">
				<div className="flex-1">
					<PulseLoader className="opacity-60" size={8} />
				</div>
			</div>
		);
	}

	// Helper function to get language from path
	const getLanguageFromPath = (path: string): string => {
		const ext = path.split(".").pop()?.toLowerCase();
		const map: Record<string, string> = {
			ts: "typescript",
			tsx: "typescript",
			js: "javascript",
			jsx: "javascript",
			mjs: "javascript",
			cjs: "javascript",
			json: "json",
			css: "css",
			scss: "scss",
			less: "less",
			html: "html",
			xml: "xml",
			md: "markdown",
			py: "python",
			rb: "ruby",
			go: "go",
			rs: "rust",
			java: "java",
			c: "c",
			cpp: "cpp",
			cs: "csharp",
			php: "php",
			sh: "shell",
			sql: "sql",
			yml: "yaml",
			yaml: "yaml",
		};
		return map[ext || ""] || "plaintext";
	};

	// Show diff viewer if requested and we have original content
	if (showDiff) {
		const original = getOriginal(sandboxId, path);
		if (original) {
			return (
				<div className="absolute w-full h-full">
					<DiffViewer
						originalContent={original}
						newContent={content.data}
						filename={path}
						language={getLanguageFromPath(path)}
					/>
				</div>
			);
		}
	}

	return (
		<div className="absolute w-full h-full">
			{editable ? (
				<FileEditor
					filename={path}
					initialContent={content.data}
					sandboxId={sandboxId}
					onUnsavedChanges={onUnsavedChanges}
					onSavingStateChange={onSavingStateChange}
					onSaveSuccess={onSaveSuccess}
				/>
			) : (
				<MonacoSyntaxHighlighter path={path} code={content.data} />
			)}
		</div>
	);
});
