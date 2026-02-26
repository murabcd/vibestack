export function normalizeDiffContent(content: string): string {
	// Treat line-ending style differences as equivalent.
	return content.replace(/\r\n/g, "\n");
}

export function hasMeaningfulDiff(a: string, b: string): boolean {
	return normalizeDiffContent(a) !== normalizeDiffContent(b);
}
