"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Monaco types for editor and monaco instances
type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

interface FileEditorProps {
	filename: string;
	initialContent: string;
	sandboxId: string;
	viewMode?: "local";
	onUnsavedChanges?: (hasChanges: boolean) => void;
	onSavingStateChange?: (isSaving: boolean) => void;
	onOpenFile?: (filename: string, lineNumber?: number) => void;
	onSaveSuccess?: () => void;
}

// Helper function to map file extensions to Monaco language IDs
function getLanguageFromPath(path: string): string {
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
}

export function FileEditor({
	filename,
	initialContent,
	sandboxId,
	viewMode = "local",
	onUnsavedChanges,
	onSavingStateChange,
	onOpenFile,
	onSaveSuccess,
}: FileEditorProps) {
	const { theme, systemTheme } = useTheme();
	const currentTheme = theme === "system" ? systemTheme : theme;
	const [content, setContent] = useState(initialContent);
	const [isSaving, setIsSaving] = useState(false);
	const [savedContent, setSavedContent] = useState(initialContent);
	const [fontSize, setFontSize] = useState(16); // Default to 16px for mobile
	const editorRef = useRef<MonacoEditor | null>(null);
	const monacoRef = useRef<Monaco | null>(null);
	const onUnsavedChangesRef = useRef(onUnsavedChanges);
	const onSavingStateChangeRef = useRef(onSavingStateChange);
	const onOpenFileRef = useRef(onOpenFile);
	const onSaveSuccessRef = useRef(onSaveSuccess);
	const handleSaveRef = useRef<(() => Promise<void>) | null>(null);

	// Set responsive font size based on screen width
	useEffect(() => {
		const updateFontSize = () => {
			// Use 16px on mobile (< 768px) to prevent zoom, 13px on desktop
			setFontSize(window.innerWidth < 768 ? 16 : 13);
		};

		// Set initial font size
		updateFontSize();

		// Update on resize
		window.addEventListener("resize", updateFontSize);
		return () => window.removeEventListener("resize", updateFontSize);
	}, []);

	// Keep refs updated
	useEffect(() => {
		onUnsavedChangesRef.current = onUnsavedChanges;
	}, [onUnsavedChanges]);

	useEffect(() => {
		onSavingStateChangeRef.current = onSavingStateChange;
	}, [onSavingStateChange]);

	useEffect(() => {
		onOpenFileRef.current = onOpenFile;
	}, [onOpenFile]);

	useEffect(() => {
		onSaveSuccessRef.current = onSaveSuccess;
	}, [onSaveSuccess]);

	useEffect(() => {
		setContent(initialContent);
		setSavedContent(initialContent);
	}, [initialContent]);

	useEffect(() => {
		// Track unsaved changes
		const hasChanges = content !== savedContent;
		if (onUnsavedChangesRef.current) {
			onUnsavedChangesRef.current(hasChanges);
		}
	}, [content, savedContent]);

	// Unsaved changes warning
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (content !== savedContent) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [content, savedContent]);

	const handleContentChange = (newContent: string | undefined) => {
		if (newContent !== undefined) {
			setContent(newContent);
		}
	};

	const handleSave = useCallback(async () => {
		const currentContent = editorRef.current?.getValue();
		if (!currentContent || isSaving || currentContent === savedContent) {
			return;
		}

		setIsSaving(true);
		if (onSavingStateChangeRef.current) {
			onSavingStateChangeRef.current(true);
		}

		try {
			const response = await fetch(`/api/sandboxes/${sandboxId}/files`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					path: filename,
					content: currentContent,
				}),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setSavedContent(currentContent);
				// Notify parent component of successful save
				if (onSaveSuccessRef.current) {
					onSaveSuccessRef.current();
				}
				toast.success("File saved successfully");
			} else {
				toast.error(data.error || "Failed to save file");
			}
		} catch (error) {
			console.error("Error saving file:", error);
			toast.error("Failed to save file");
		} finally {
			setIsSaving(false);
			if (onSavingStateChangeRef.current) {
				onSavingStateChangeRef.current(false);
			}
		}
	}, [isSaving, savedContent, sandboxId, filename]);

	// Keep handleSave ref updated
	useEffect(() => {
		handleSaveRef.current = handleSave;
	}, [handleSave]);

	// Define themes before mount to prevent light mode flash
	const handleBeforeMount = useCallback((monaco: Monaco) => {
		// Define Vercel/Geist dark theme (matching ray-so)
		monaco.editor.defineTheme("vercel-dark", {
			base: "vs-dark",
			inherit: true,
			rules: [
				{ token: "", foreground: "ededed" },
				{ token: "comment", foreground: "a1a1a1" },
				{ token: "keyword", foreground: "ff6b9d" },
				{ token: "string", foreground: "79f2a8" },
				{ token: "string.escape", foreground: "79f2a8" },
				{ token: "number", foreground: "ffffff" },
				{ token: "constant", foreground: "9ca7ff" },
				{ token: "constant.numeric", foreground: "ffffff" },
				{ token: "variable", foreground: "ededed" },
				{ token: "variable.parameter", foreground: "ffd494" },
				{ token: "function", foreground: "ea94ea" },
				{ token: "identifier", foreground: "ededed" },
				{ token: "type", foreground: "9ca7ff" },
				{ token: "type.identifier", foreground: "9ca7ff" },
				{ token: "class.name", foreground: "9ca7ff" },
				{ token: "delimiter", foreground: "ededed" },
				{ token: "delimiter.bracket", foreground: "ededed" },
				{ token: "tag", foreground: "ff6b9d" },
				{ token: "tag.id", foreground: "9ca7ff" },
				{ token: "tag.class", foreground: "9ca7ff" },
				{ token: "attribute.name", foreground: "9ca7ff" },
				{ token: "attribute.value", foreground: "79f2a8" },
				{ token: "meta.tag", foreground: "ededed" },
			],
			colors: {
				"editor.background": "#000000",
				"editor.foreground": "#ededed",
				"editor.lineHighlightBackground": "#1a1a1a",
				"editorLineNumber.foreground": "#6b6b6b",
				"editorLineNumber.activeForeground": "#a1a1a1",
				"editor.selectionBackground": "#3d5a80",
				"editor.inactiveSelectionBackground": "#2d4a60",
				"editorCursor.foreground": "#ededed",
				"editorWhitespace.foreground": "#3a3a3a",
				"editorIndentGuide.background": "#1a1a1a",
				"editorIndentGuide.activeBackground": "#2a2a2a",
				"editorBracketMatch.background": "#1a1a1a",
				"editorBracketMatch.border": "#9ca7ff",
			},
		});

		// Define Vercel/Geist light theme (matching ray-so)
		monaco.editor.defineTheme("vercel-light", {
			base: "vs",
			inherit: true,
			rules: [
				{ token: "", foreground: "171717" },
				{ token: "comment", foreground: "666666" },
				{ token: "keyword", foreground: "d63384" },
				{ token: "string", foreground: "028a5a" },
				{ token: "string.escape", foreground: "028a5a" },
				{ token: "number", foreground: "111111" },
				{ token: "constant", foreground: "0550ae" },
				{ token: "constant.numeric", foreground: "111111" },
				{ token: "variable", foreground: "171717" },
				{ token: "variable.parameter", foreground: "c77700" },
				{ token: "function", foreground: "8250df" },
				{ token: "identifier", foreground: "171717" },
				{ token: "type", foreground: "0550ae" },
				{ token: "type.identifier", foreground: "0550ae" },
				{ token: "class.name", foreground: "0550ae" },
				{ token: "delimiter", foreground: "171717" },
				{ token: "delimiter.bracket", foreground: "171717" },
				{ token: "tag", foreground: "d63384" },
				{ token: "tag.id", foreground: "0550ae" },
				{ token: "tag.class", foreground: "0550ae" },
				{ token: "attribute.name", foreground: "0550ae" },
				{ token: "attribute.value", foreground: "028a5a" },
				{ token: "meta.tag", foreground: "171717" },
			],
			colors: {
				"editor.background": "#ffffff",
				"editor.foreground": "#171717",
				"editor.lineHighlightBackground": "#f8f8f8",
				"editorLineNumber.foreground": "#9ca3af",
				"editorLineNumber.activeForeground": "#666666",
				"editor.selectionBackground": "#b3d7ff",
				"editor.inactiveSelectionBackground": "#d3e5f8",
				"editorCursor.foreground": "#171717",
				"editorWhitespace.foreground": "#e5e5e5",
				"editorIndentGuide.background": "#f0f0f0",
				"editorIndentGuide.activeBackground": "#e0e0e0",
				"editorBracketMatch.background": "#f0f0f0",
				"editorBracketMatch.border": "#0550ae",
			},
		});
	}, []);

	const handleEditorMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;
		monacoRef.current = monaco;

		// Disable Monaco's built-in TypeScript diagnostics since we're using the sandbox
		monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: true,
			noSyntaxValidation: false,
			noSuggestionDiagnostics: true,
		});

		monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
			noSemanticValidation: true,
			noSyntaxValidation: false,
			noSuggestionDiagnostics: true,
		});

		// Add save command (Cmd/Ctrl + S)
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
			if (handleSaveRef.current) {
				handleSaveRef.current();
			}
		});
	};

	// Keyboard shortcut for save (Cmd/Ctrl + S) - fallback for outside editor
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				if (handleSaveRef.current) {
					handleSaveRef.current();
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Check if this is a node_modules file (read-only)
	const isNodeModulesFile = filename.includes("/node_modules/");
	const isReadOnly = isNodeModulesFile;

	return (
		<div className="flex flex-col h-full">
			{isNodeModulesFile && (
				<div className="px-3 py-2 text-xs bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400">
					Read-only: node_modules file
				</div>
			)}
			<Editor
				height="100%"
				language={getLanguageFromPath(filename)}
				value={content}
				onChange={handleContentChange}
				beforeMount={handleBeforeMount}
				onMount={handleEditorMount}
				theme={currentTheme === "dark" ? "vercel-dark" : "vercel-light"}
				options={{
					readOnly: isReadOnly,
					minimap: { enabled: false },
					fontSize: fontSize,
					fontFamily:
						'var(--font-geist-mono), "Geist Mono", Menlo, Monaco, "Courier New", monospace',
					lineNumbers: "on",
					wordWrap: "on",
					automaticLayout: true,
					scrollBeyondLastLine: false,
					renderWhitespace: "selection",
					tabSize: 2,
					insertSpaces: true,
					folding: true,
					foldingStrategy: "indentation",
					showFoldingControls: "mouseover",
					matchBrackets: "always",
					autoClosingBrackets: "always",
					autoClosingQuotes: "always",
					suggestOnTriggerCharacters: true,
					quickSuggestions: true,
					suggest: {
						showKeywords: true,
						showSnippets: true,
					},
				}}
			/>
		</div>
	);
}
