import { describe, expect, it } from "vitest";

import {
	isInstallCommand,
	normalizePackageJsonForInstall,
} from "../../lib/ai/tools/run-command-install-preflight";

describe("run-command install preflight", () => {
	it("detects install commands across package managers", () => {
		expect(isInstallCommand("pnpm", ["install"])).toBe(true);
		expect(isInstallCommand("npm", ["i"])).toBe(true);
		expect(isInstallCommand("yarn", ["install"])).toBe(true);
		expect(isInstallCommand("bun", ["install"])).toBe(true);
		expect(isInstallCommand("pnpm", ["exec", "next", "dev"])).toBe(false);
	});

	it("does not rewrite framework versions during install preflight", () => {
		const input = JSON.stringify(
			{
				name: "demo",
				dependencies: {
					next: "14.2.5",
					react: "18.3.1",
					"react-dom": "18.3.1",
				},
				devDependencies: {
					typescript: "4.9.5",
				},
			},
			null,
			2,
		);

		const result = normalizePackageJsonForInstall(input);
		expect(result.changed).toBe(false);
		expect(result.changes).toEqual([]);
	});

	it("keeps modern versions unchanged", () => {
		const input = JSON.stringify(
			{
				name: "demo",
				dependencies: {
					next: "^16.1.6",
					react: "^19.2.4",
					"react-dom": "^19.2.4",
				},
				devDependencies: {
					typescript: "^5.9.3",
				},
			},
			null,
			2,
		);

		const result = normalizePackageJsonForInstall(input);
		expect(result.changed).toBe(false);
		expect(result.changes).toEqual([]);
		expect(result.text).toBe(input);
	});

	it("does not mutate non-Next projects", () => {
		const input = JSON.stringify(
			{
				name: "node-service",
				dependencies: {
					express: "^5.0.0",
				},
				devDependencies: {
					typescript: "4.9.5",
				},
			},
			null,
			2,
		);

		const result = normalizePackageJsonForInstall(input);
		expect(result.changed).toBe(false);
		expect(result.changes).toEqual([]);
	});

	it("adds missing autoprefixer for Next + Tailwind + PostCSS setups", () => {
		const input = JSON.stringify(
			{
				name: "next-app",
				dependencies: {
					next: "^16.1.6",
					react: "^19.2.4",
					"react-dom": "^19.2.4",
				},
				devDependencies: {
					postcss: "^8.5.0",
					tailwindcss: "^3.4.0",
					typescript: "^5.9.0",
				},
			},
			null,
			2,
		);

		const result = normalizePackageJsonForInstall(input);
		expect(result.changed).toBe(true);
		expect(result.changes).toEqual(["autoprefixer: added latest"]);

		const parsed = JSON.parse(result.text) as {
			devDependencies: Record<string, string>;
		};
		expect(parsed.devDependencies.autoprefixer).toBe("latest");
	});
});
