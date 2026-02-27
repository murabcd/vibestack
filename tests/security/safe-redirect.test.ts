import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "../../lib/auth/safe-redirect";

describe("sanitizeRedirectPath", () => {
	it("allows local relative paths", () => {
		expect(sanitizeRedirectPath("/project/abc?tab=chat")).toBe(
			"/project/abc?tab=chat",
		);
	});

	it("falls back to root for empty input", () => {
		expect(sanitizeRedirectPath(undefined)).toBe("/");
		expect(sanitizeRedirectPath(null)).toBe("/");
		expect(sanitizeRedirectPath("")).toBe("/");
	});

	it("blocks absolute external URLs", () => {
		expect(sanitizeRedirectPath("https://evil.example/pwn")).toBe("/");
		expect(sanitizeRedirectPath("http://evil.example/pwn")).toBe("/");
	});

	it("blocks protocol-relative and scheme payloads", () => {
		expect(sanitizeRedirectPath("//evil.example/path")).toBe("/");
		expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/");
		expect(sanitizeRedirectPath("data:text/html,test")).toBe("/");
	});

	it("blocks backslash path tricks", () => {
		expect(sanitizeRedirectPath("/foo\\bar")).toBe("/");
	});
});
