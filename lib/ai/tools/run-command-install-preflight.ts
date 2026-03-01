type PackageJsonRecord = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

interface NormalizeResult {
	changed: boolean;
	text: string;
	changes: string[];
}

const MIN_MAJOR_BY_PACKAGE: Record<string, number> = {
	next: 16,
	react: 19,
	"react-dom": 19,
	typescript: 5,
};

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
		upgradeIfOutdated(deps, "next", changes);
		upgradeIfOutdated(deps, "react", changes);
		upgradeIfOutdated(deps, "react-dom", changes);
		upgradeIfOutdated(devDeps, "typescript", changes);
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

function upgradeIfOutdated(
	deps: Record<string, string>,
	name: keyof typeof MIN_MAJOR_BY_PACKAGE,
	changes: string[],
): void {
	const current = deps[name];
	if (typeof current !== "string") return;
	if (current.trim() === "latest") return;

	const minMajor = MIN_MAJOR_BY_PACKAGE[name];
	const major = extractMajor(current);
	if (major === null || major >= minMajor) return;

	deps[name] = "latest";
	changes.push(`${name}: ${current} -> latest`);
}

function extractMajor(version: string): number | null {
	const match = version.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
	if (!match) return null;
	const value = Number.parseInt(match[1], 10);
	return Number.isFinite(value) ? value : null;
}
