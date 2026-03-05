import { describe, expect, it } from "vitest";
import {
	getCommandValidationError,
	needsCommandApproval,
} from "../../lib/ai/tools/run-command-validation";

describe("run-command safety validation", () => {
	it("allows safe commands", () => {
		expect(
			getCommandValidationError("python3", [
				"-m",
				"http.server",
				"3000",
				"--bind",
				"0.0.0.0",
			]),
		).toBeNull();
	});

	it("requires approval for destructive git reset hard", () => {
		expect(getCommandValidationError("git", ["reset", "--hard"])).toBeNull();
		expect(needsCommandApproval("git", ["reset", "--hard"])).toBe(true);
	});

	it("requires approval for destructive git clean force", () => {
		expect(getCommandValidationError("git", ["clean", "-fdx"])).toBeNull();
		expect(needsCommandApproval("git", ["clean", "-fdx"])).toBe(true);
	});

	it("requires approval for rm with recursive or force", () => {
		expect(getCommandValidationError("rm", ["-rf", "tmp"])).toBeNull();
		expect(getCommandValidationError("rm", ["-fr", "."])).toBeNull();
		expect(needsCommandApproval("rm", ["-rf", "tmp"])).toBe(true);
		expect(needsCommandApproval("rm", ["-fr", "."])).toBe(true);
	});

	it("still blocks root filesystem deletion", () => {
		expect(getCommandValidationError("rm", ["-rf", "/"])).toContain("blocked");
	});

	it("blocks banned executables", () => {
		expect(getCommandValidationError("shutdown", ["-h", "now"])).toContain(
			"blocked",
		);
	});
});
