const EXACT_PROTECTED_PATHS = new Set([
	".env",
	".env.local",
	".env.production",
	".env.development",
	"bun.lock",
	"bun.lockb",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
]);

const PROTECTED_PREFIXES = [".git/", "node_modules/"];

export function isProtectedMutationPath(path: string): boolean {
	const normalized = normalizePath(path);
	if (!normalized) return false;
	if (EXACT_PROTECTED_PATHS.has(normalized)) return true;
	return PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function normalizePath(path: string): string {
	let next = path.trim().replaceAll("\\", "/");
	next = next.replace(/^\.\/+/, "");
	next = next.replace(/^\/+/, "");
	return next;
}
