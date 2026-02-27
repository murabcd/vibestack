import { afterEach, describe, expect, it, vi } from "vitest";
import {
	validateLocalMcpCommand,
	validateRemoteMcpUrl,
} from "../../lib/security/mcp";

describe("validateRemoteMcpUrl", () => {
	it("allows public https URLs", () => {
		expect(validateRemoteMcpUrl("https://mcp.example.com/sse")).toEqual({
			valid: true,
		});
	});

	it("blocks non-https URLs", () => {
		expect(validateRemoteMcpUrl("http://mcp.example.com")).toEqual({
			valid: false,
			reason: "Only https URLs are allowed",
		});
	});

	it("blocks localhost and private network targets", () => {
		expect(validateRemoteMcpUrl("https://localhost/sse")).toEqual({
			valid: false,
			reason: "Local network hosts are not allowed",
		});
		expect(validateRemoteMcpUrl("https://127.0.0.1/sse")).toEqual({
			valid: false,
			reason: "Local network hosts are not allowed",
		});
		expect(validateRemoteMcpUrl("https://192.168.1.10/sse")).toEqual({
			valid: false,
			reason: "Private network IP ranges are not allowed",
		});
		expect(
			validateRemoteMcpUrl("https://169.254.169.254/latest/meta-data"),
		).toEqual({
			valid: false,
			reason: "Private network IP ranges are not allowed",
		});
	});
});

describe("validateLocalMcpCommand", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("allows commands in non-production", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(validateLocalMcpCommand("node server.js")).toEqual({ valid: true });
	});

	it("blocks commands in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(validateLocalMcpCommand("node server.js")).toEqual({
			valid: false,
			reason: "Local MCP connectors are disabled in production",
		});
	});

	it("rejects empty command", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(validateLocalMcpCommand("   ")).toEqual({
			valid: false,
			reason: "Command is required",
		});
	});
});
