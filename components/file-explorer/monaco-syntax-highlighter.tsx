"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

// Monaco types for editor and monaco instances
type Monaco = Parameters<OnMount>[1];

interface MonacoSyntaxHighlighterProps {
	path: string;
	code: string;
	className?: string;
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

export function MonacoSyntaxHighlighter({
	path,
	code,
	className,
}: MonacoSyntaxHighlighterProps) {
	const { theme, systemTheme } = useTheme();
	const currentTheme = theme === "system" ? systemTheme : theme;
	const [fontSize, setFontSize] = useState(16); // Default to 16px for mobile

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

	// Define themes before mount to prevent light mode flash
	const handleBeforeMount = useMemo(() => {
		return (monaco: Monaco) => {
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
		};
	}, []);

	const handleEditorMount: OnMount = (_editor, monaco) => {
		// Disable Monaco's built-in TypeScript diagnostics for read-only display
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
	};

	return (
		<div className={`absolute inset-0 ${className || ""}`}>
			<Editor
				height="100%"
				width="100%"
				language={getLanguageFromPath(path)}
				value={code}
				beforeMount={handleBeforeMount}
				onMount={handleEditorMount}
				theme={currentTheme === "dark" ? "vercel-dark" : "vercel-light"}
				options={{
					readOnly: true,
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
					// Disable interactions for read-only display
					contextmenu: false,
					selectOnLineNumbers: false,
					glyphMargin: false,
					lineDecorationsWidth: 0,
					lineNumbersMinChars: 0,
				}}
			/>
		</div>
	);
}
