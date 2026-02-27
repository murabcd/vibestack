import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionFromReq = vi.fn();
const getProjectBySandboxId = vi.fn();

vi.mock("@/lib/session/server", () => ({
	getSessionFromReq,
}));

vi.mock("@/lib/db/queries", () => ({
	getProjectBySandboxId,
}));

describe("authorizeSandboxOwner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when session is missing", async () => {
		getSessionFromReq.mockResolvedValue(undefined);
		const { authorizeSandboxOwner } = await import(
			"../../app/api/sandboxes/_auth"
		);

		const result = await authorizeSandboxOwner({} as NextRequest, "sbx_123");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("Expected unauthorized result");
		expect(result.response.status).toBe(401);
		expect(await result.response.json()).toEqual({
			error: "Authentication required",
		});
	});

	it("returns 403 when project is missing or owned by another user", async () => {
		getSessionFromReq.mockResolvedValue({ user: { id: "user-a" } });
		getProjectBySandboxId.mockResolvedValue({ userId: "user-b" });
		const { authorizeSandboxOwner } = await import(
			"../../app/api/sandboxes/_auth"
		);

		const result = await authorizeSandboxOwner({} as NextRequest, "sbx_123");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("Expected forbidden result");
		expect(result.response.status).toBe(403);
		expect(await result.response.json()).toEqual({ error: "Forbidden" });
	});

	it("returns ok for owner", async () => {
		getSessionFromReq.mockResolvedValue({ user: { id: "user-a" } });
		getProjectBySandboxId.mockResolvedValue({ userId: "user-a" });
		const { authorizeSandboxOwner } = await import(
			"../../app/api/sandboxes/_auth"
		);

		const result = await authorizeSandboxOwner({} as NextRequest, "sbx_123");
		expect(result).toEqual({ ok: true });
	});
});
