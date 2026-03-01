"use client";

import { useEffect, useRef, useState } from "react";

type TokenKind =
	| "keyword"
	| "string"
	| "fn"
	| "number"
	| "tag"
	| "comment"
	| "plain";

interface Token {
	t: string;
	c: TokenKind;
}

interface CodeLine {
	indent: number;
	tokens: Token[];
}

const FILES: { name: string; lines: CodeLine[] }[] = [
	{
		name: "app/page.tsx",
		lines: [
			{
				indent: 0,
				tokens: [
					{ t: "import", c: "keyword" },
					{ t: " { Metadata } ", c: "plain" },
					{ t: "from", c: "keyword" },
					{ t: " 'next'", c: "string" },
				],
			},
			{
				indent: 0,
				tokens: [
					{ t: "import", c: "keyword" },
					{ t: " Hero ", c: "plain" },
					{ t: "from", c: "keyword" },
					{ t: " '@/components/hero'", c: "string" },
				],
			},
			{ indent: 0, tokens: [] },
			{
				indent: 0,
				tokens: [
					{ t: "export const ", c: "keyword" },
					{ t: "metadata", c: "fn" },
					{ t: ": ", c: "plain" },
					{ t: "Metadata", c: "fn" },
					{ t: " = {", c: "plain" },
				],
			},
			{
				indent: 1,
				tokens: [
					{ t: "title", c: "plain" },
					{ t: ": ", c: "plain" },
					{ t: "'My App'", c: "string" },
					{ t: ",", c: "plain" },
				],
			},
			{
				indent: 1,
				tokens: [
					{ t: "description", c: "plain" },
					{ t: ": ", c: "plain" },
					{ t: "'Built with v0'", c: "string" },
				],
			},
			{ indent: 0, tokens: [{ t: "}", c: "plain" }] },
			{ indent: 0, tokens: [] },
			{
				indent: 0,
				tokens: [
					{ t: "export default ", c: "keyword" },
					{ t: "function", c: "keyword" },
					{ t: " Page", c: "fn" },
					{ t: "() {", c: "plain" },
				],
			},
			{
				indent: 1,
				tokens: [
					{ t: "return", c: "keyword" },
					{ t: " (", c: "plain" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "main", c: "tag" },
					{ t: " className=", c: "plain" },
					{ t: '"flex flex-col"', c: "string" },
					{ t: ">", c: "tag" },
				],
			},
			{
				indent: 3,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "Hero", c: "fn" },
					{ t: " />", c: "tag" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "</", c: "tag" },
					{ t: "main", c: "tag" },
					{ t: ">", c: "tag" },
				],
			},
			{ indent: 1, tokens: [{ t: ")", c: "plain" }] },
			{ indent: 0, tokens: [{ t: "}", c: "plain" }] },
		],
	},
	{
		name: "components/hero.tsx",
		lines: [
			{ indent: 0, tokens: [{ t: "// Hero section component", c: "comment" }] },
			{
				indent: 0,
				tokens: [
					{ t: "export default ", c: "keyword" },
					{ t: "function", c: "keyword" },
					{ t: " Hero", c: "fn" },
					{ t: "() {", c: "plain" },
				],
			},
			{
				indent: 1,
				tokens: [
					{ t: "return", c: "keyword" },
					{ t: " (", c: "plain" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "section", c: "tag" },
					{ t: " className=", c: "plain" },
					{ t: '"py-24 px-6"', c: "string" },
					{ t: ">", c: "tag" },
				],
			},
			{
				indent: 3,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "h1", c: "tag" },
					{ t: " className=", c: "plain" },
					{ t: '"text-5xl font-bold"', c: "string" },
					{ t: ">", c: "tag" },
				],
			},
			{ indent: 4, tokens: [{ t: "Hello World", c: "plain" }] },
			{
				indent: 3,
				tokens: [
					{ t: "</", c: "tag" },
					{ t: "h1", c: "tag" },
					{ t: ">", c: "tag" },
				],
			},
			{
				indent: 3,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "p", c: "tag" },
					{ t: " className=", c: "plain" },
					{ t: '"text-lg text-muted-foreground"', c: "string" },
					{ t: ">", c: "tag" },
				],
			},
			{ indent: 4, tokens: [{ t: "Built with AI.", c: "plain" }] },
			{
				indent: 3,
				tokens: [
					{ t: "</", c: "tag" },
					{ t: "p", c: "tag" },
					{ t: ">", c: "tag" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "</", c: "tag" },
					{ t: "section", c: "tag" },
					{ t: ">", c: "tag" },
				],
			},
			{ indent: 1, tokens: [{ t: ")", c: "plain" }] },
			{ indent: 0, tokens: [{ t: "}", c: "plain" }] },
		],
	},
	{
		name: "components/navbar.tsx",
		lines: [
			{
				indent: 0,
				tokens: [
					{ t: "import", c: "keyword" },
					{ t: " Link ", c: "plain" },
					{ t: "from", c: "keyword" },
					{ t: " 'next/link'", c: "string" },
				],
			},
			{ indent: 0, tokens: [] },
			{
				indent: 0,
				tokens: [
					{ t: "const ", c: "keyword" },
					{ t: "links", c: "fn" },
					{ t: " = [", c: "plain" },
					{ t: "'Home'", c: "string" },
					{ t: ", ", c: "plain" },
					{ t: "'About'", c: "string" },
					{ t: ", ", c: "plain" },
					{ t: "'Pricing'", c: "string" },
					{ t: "]", c: "plain" },
				],
			},
			{ indent: 0, tokens: [] },
			{
				indent: 0,
				tokens: [
					{ t: "export default ", c: "keyword" },
					{ t: "function", c: "keyword" },
					{ t: " Navbar", c: "fn" },
					{ t: "() {", c: "plain" },
				],
			},
			{
				indent: 1,
				tokens: [
					{ t: "return", c: "keyword" },
					{ t: " (", c: "plain" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "<", c: "tag" },
					{ t: "nav", c: "tag" },
					{ t: " className=", c: "plain" },
					{ t: '"flex justify-between p-4"', c: "string" },
					{ t: ">", c: "tag" },
				],
			},
			{
				indent: 3,
				tokens: [
					{ t: "{links.", c: "plain" },
					{ t: "map", c: "fn" },
					{ t: "(l => ", c: "plain" },
					{ t: "<", c: "tag" },
					{ t: "Link", c: "fn" },
					{ t: " href=", c: "plain" },
					{ t: '"/"', c: "string" },
					{ t: ">", c: "tag" },
					{ t: "{l}", c: "fn" },
					{ t: "</", c: "tag" },
					{ t: "Link", c: "fn" },
					{ t: ">)}", c: "plain" },
				],
			},
			{
				indent: 2,
				tokens: [
					{ t: "</", c: "tag" },
					{ t: "nav", c: "tag" },
					{ t: ">", c: "tag" },
				],
			},
			{ indent: 1, tokens: [{ t: ")", c: "plain" }] },
			{ indent: 0, tokens: [{ t: "}", c: "plain" }] },
		],
	},
];

function CodePanel({
	fileIndex,
	charReveal,
}: {
	fileIndex: number;
	charReveal: number;
}) {
	const file = FILES[fileIndex];
	let globalChar = 0;

	return (
		<div className="rounded-xl border border-border overflow-hidden bg-background w-full max-w-[640px]">
			<div className="px-4 py-2 border-b border-border bg-muted/30">
				<span className="text-[11px] font-mono text-muted-foreground tracking-wide">
					{file.name}
				</span>
			</div>
			<div className="p-4 space-y-0.5 min-h-[260px]">
				{file.lines.map((line, li) => {
					const lineText = line.tokens.map((tk) => tk.t).join("");
					const lineStart = globalChar;
					globalChar += lineText.length;

					// How many chars of this line are visible
					const lineVisible = Math.max(
						0,
						Math.min(lineText.length, charReveal - lineStart),
					);
					const isCurrentLine =
						charReveal > lineStart && charReveal <= lineStart + lineText.length;

					let tokenChar = 0;
					return (
						<div
							key={`${file.name}:${li}:${lineStart}`}
							className="flex items-start gap-3 font-mono text-[11px] leading-[1.7] text-foreground/80"
						>
							<span className="w-5 shrink-0 text-right text-muted-foreground/50 select-none">
								{li + 1}
							</span>
							<span
								style={{ paddingLeft: `${line.indent * 14}px` }}
								className="flex flex-wrap items-center"
							>
								{line.tokens.map((tk) => {
									const start = tokenChar;
									tokenChar += tk.t.length;
									const visible = Math.max(
										0,
										Math.min(tk.t.length, lineVisible - start),
									);
									return (
										<span key={`${file.name}:${lineStart}:${start}:${tk.c}`}>
											{tk.t.slice(0, visible)}
										</span>
									);
								})}
								{/* Blinking cursor on the active line */}
								{isCurrentLine && (
									<span className="inline-block w-[2px] h-[13px] bg-primary animate-pulse ml-px align-middle" />
								)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function PreviewLoading() {
	const [charReveal, setCharReveal] = useState(0);
	const [fileIndex, setFileIndex] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const currentFile = FILES[fileIndex];
	const totalChars = currentFile.lines.reduce(
		(sum, l) => sum + l.tokens.map((t) => t.t).join("").length,
		0,
	);

	useEffect(() => {
		setCharReveal(0);

		intervalRef.current = setInterval(() => {
			setCharReveal((prev) => {
				if (prev >= totalChars) {
					// Pause briefly then switch to next file
					if (intervalRef.current) {
						clearInterval(intervalRef.current);
						intervalRef.current = null;
					}
					setTimeout(() => {
						setFileIndex((fi) => (fi + 1) % FILES.length);
					}, 900);
					return prev;
				}
				return prev + 6;
			});
		}, 20);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [totalChars]);

	return (
		<div className="w-full h-full bg-background flex items-center justify-center p-8">
			<CodePanel fileIndex={fileIndex} charReveal={charReveal} />
		</div>
	);
}
