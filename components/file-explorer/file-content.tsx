import dynamic from "next/dynamic";
import { memo, useEffect } from "react";
import useSWR from "swr";
import { useFileHistory } from "@/app/state";
import { DiffViewer } from "./diff-viewer";
import { MonacoLoadingSkeleton } from "./monaco-loading-skeleton";

const FileEditor = dynamic(
	() => import("./file-editor").then((mod) => mod.FileEditor),
	{
		ssr: false,
		loading: () => <MonacoLoadingSkeleton />,
	},
);

const MonacoSyntaxHighlighter = dynamic(
	() =>
		import("./monaco-syntax-highlighter").then(
			(mod) => mod.MonacoSyntaxHighlighter,
		),
	{
		ssr: false,
		loading: () => <MonacoLoadingSkeleton />,
	},
);

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
		{
			refreshInterval: 3000,
			dedupingInterval: 2000,
			revalidateOnFocus: false,
		},
	);

	// Track original content when first loaded - capture before AI modifications
	useEffect(() => {
		if (content.data && sandboxId && path) {
			captureOriginalBeforeAI(sandboxId, path, content.data);
		}
	}, [content.data, sandboxId, path, captureOriginalBeforeAI]);

	if (content.isLoading || !content.data) {
		return <MonacoLoadingSkeleton />;
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
