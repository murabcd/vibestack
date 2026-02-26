import dynamic from "next/dynamic";
import { memo, useEffect } from "react";
import useSWR from "swr";
import { useFileHistory } from "@/app/state";
import { hasMeaningfulDiff } from "./diff-utils";
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

class FileContentError extends Error {
	code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.code = code;
	}
}

interface Props {
	sandboxId: string;
	path: string;
	editable?: boolean;
	showDiff?: boolean;
	revealRequest?: {
		lineNumber: number;
		requestId: number;
	};
	onDiffAvailabilityChange?: (hasDiff: boolean) => void;
	onOpenFile?: (filename: string, lineNumber?: number) => void;
	onUnsavedChanges?: (hasChanges: boolean) => void;
	onSavingStateChange?: (isSaving: boolean) => void;
	onSaveSuccess?: () => void;
	onEditorAvailabilityChange?: (isAvailable: boolean) => void;
}

export const FileContent = memo(function FileContent({
	sandboxId,
	path,
	editable = false,
	showDiff = false,
	revealRequest,
	onDiffAvailabilityChange,
	onOpenFile,
	onUnsavedChanges,
	onSavingStateChange,
	onSaveSuccess,
	onEditorAvailabilityChange,
}: Props) {
	const getOriginal = useFileHistory((state) => state.getOriginal);
	const setHasDiff = useFileHistory((state) => state.setHasDiff);
	const captureOriginalBeforeAI = useFileHistory(
		(state) => state.captureOriginalBeforeAI,
	);
	const searchParams = new URLSearchParams({ path });
	const content = useSWR(
		`/api/sandboxes/${sandboxId}/files?${searchParams.toString()}`,
		async (pathname: string, init: RequestInit) => {
			const response = await fetch(pathname, init);
			if (!response.ok) {
				let message = `Failed to load ${path}`;
				let code: string | undefined;
				try {
					const json = await response.json();
					if (typeof json?.error === "string") {
						message = json.error;
					}
					if (typeof json?.error?.code === "string") {
						code = json.error.code;
					}
				} catch {
					// keep fallback message
				}
				throw new FileContentError(message, code);
			}
			const text = await response.text();
			let parsed:
				| {
						error?:
							| string
							| {
									code?: string;
									message?: string;
							  };
				  }
				| undefined;
			try {
				parsed = JSON.parse(text) as {
					error?:
						| string
						| {
								code?: string;
								message?: string;
						  };
				};
			} catch {
				// Non-JSON file content is expected.
			}
			if (parsed) {
				const code =
					typeof parsed.error === "object" ? parsed.error?.code : undefined;
				const message =
					typeof parsed.error === "object"
						? parsed.error?.message
						: typeof parsed.error === "string"
							? parsed.error
							: undefined;
				if (code === "sandbox_stopped") {
					throw new FileContentError(
						message ?? "Sandbox is stopped",
						"sandbox_stopped",
					);
				}
			}
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
		onEditorAvailabilityChange?.(!content.error && !content.isLoading);
	}, [content.error, content.isLoading, onEditorAvailabilityChange]);

	// Track original content when first loaded - capture before AI modifications
	useEffect(() => {
		if (content.data && sandboxId && path) {
			captureOriginalBeforeAI(sandboxId, path, content.data);
		}
	}, [content.data, sandboxId, path, captureOriginalBeforeAI]);

	// Report whether this file currently has real changes to diff.
	useEffect(() => {
		if (!content.data) {
			setHasDiff(sandboxId, path, false);
			onDiffAvailabilityChange?.(false);
			return;
		}
		const original = getOriginal(sandboxId, path);
		const hasDiff = original
			? hasMeaningfulDiff(original, content.data)
			: false;
		setHasDiff(sandboxId, path, hasDiff);
		onDiffAvailabilityChange?.(hasDiff);
	}, [
		content.data,
		sandboxId,
		path,
		getOriginal,
		setHasDiff,
		onDiffAvailabilityChange,
	]);

	if (content.error) {
		const message =
			content.error instanceof Error
				? content.error.message
				: "Failed to load file";
		const sandboxStopped =
			content.error instanceof FileContentError &&
			content.error.code === "sandbox_stopped";
		return (
			<div className="h-full w-full flex items-center justify-center p-4">
				<div className="text-center">
					<p className="text-destructive mb-2 text-sm">Unable to load file</p>
					<p className="text-xs text-muted-foreground">{message}</p>
					{sandboxStopped && (
						<p className="text-xs text-muted-foreground mt-2">
							Start or restart the dev server from the toolbar.
						</p>
					)}
				</div>
			</div>
		);
	}

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
				<div className="relative h-full w-full overflow-hidden">
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
		<div className="relative h-full w-full overflow-hidden">
			{editable ? (
				<FileEditor
					filename={path}
					initialContent={content.data}
					sandboxId={sandboxId}
					revealRequest={revealRequest}
					onOpenFile={onOpenFile}
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
