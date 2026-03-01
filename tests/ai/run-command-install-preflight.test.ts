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

	it("upgrades outdated Next/React/TypeScript versions to latest for install", () => {
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
		expect(result.changed).toBe(true);
		expect(result.changes).toEqual([
			"next: 14.2.5 -> latest",
			"react: 18.3.1 -> latest",
			"react-dom: 18.3.1 -> latest",
			"typescript: 4.9.5 -> latest",
		]);

		const parsed = JSON.parse(result.text) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};
		expect(parsed.dependencies.next).toBe("latest");
		expect(parsed.dependencies.react).toBe("latest");
		expect(parsed.dependencies["react-dom"]).toBe("latest");
		expect(parsed.devDependencies.typescript).toBe("latest");
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
});
