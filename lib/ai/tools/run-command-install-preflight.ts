type PackageJsonRecord = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

interface NormalizeResult {
	changed: boolean;
	text: string;
	changes: string[];
}

export function isInstallCommand(command: string, args: string[]): boolean {
	const normalized = command.trim();
	if (!["pnpm", "npm", "yarn", "bun"].includes(normalized)) {
		return false;
	}
	const firstArg = args[0]?.trim();
	return firstArg === "install" || firstArg === "i";
}

export function normalizePackageJsonForInstall(
	packageJsonText: string,
): NormalizeResult {
	let parsed: PackageJsonRecord;
	try {
		parsed = JSON.parse(packageJsonText) as PackageJsonRecord;
	} catch {
		return { changed: false, text: packageJsonText, changes: [] };
	}

	const changes: string[] = [];
	const deps = parsed.dependencies ?? {};
	const devDeps = parsed.devDependencies ?? {};
	const hasNext = typeof deps.next === "string";

	if (hasNext) {
		ensureAutoprefixer(devDeps, deps, changes);
	}

	if (changes.length === 0) {
		return { changed: false, text: packageJsonText, changes: [] };
	}

	parsed.dependencies = deps;
	parsed.devDependencies = devDeps;
	return {
		changed: true,
		text: `${JSON.stringify(parsed, null, 2)}\n`,
		changes,
	};
}

function ensureAutoprefixer(
	devDeps: Record<string, string>,
	deps: Record<string, string>,
	changes: string[],
): void {
	const hasPostcss = typeof devDeps.postcss === "string";
	const hasTailwind =
		typeof devDeps.tailwindcss === "string" ||
		typeof deps.tailwindcss === "string";
	const hasAutoprefixer =
		typeof devDeps.autoprefixer === "string" ||
		typeof deps.autoprefixer === "string";

	if (hasPostcss && hasTailwind && !hasAutoprefixer) {
		devDeps.autoprefixer = "latest";
		changes.push("autoprefixer: added latest");
	}
}
