import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProjectById = vi.fn();
const getSessionFromReq = vi.fn();
const createApiWideEvent = vi.fn(() => ({
	add: vi.fn(),
	end: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
	getProjectById,
	updateProject: vi.fn(),
	deleteMessagesByProjectId: vi.fn(),
	deleteProject: vi.fn(),
}));

vi.mock("@/lib/session/server", () => ({
	getSessionFromReq,
}));

vi.mock("@/lib/logging/wide-event", () => ({
	createApiWideEvent,
}));

describe("projects/[projectId] GET", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hides sandbox metadata for non-owner public project", async () => {
		getSessionFromReq.mockResolvedValue({ user: { id: "viewer" } });
		getProjectById.mockResolvedValue({
			projectId: "p1",
			title: "Project",
			visibility: "public",
			userId: "owner",
			sandboxId: "sbx_secret",
			sandboxUrl: "https://sandbox.example",
			previewUrl: "https://preview.example",
		});

		const { GET } = await import("../../app/api/projects/[projectId]/route");
		const response = await GET({} as NextRequest, {
			params: Promise.resolve({ projectId: "p1" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.project.sandboxId).toBeNull();
		expect(body.project.sandboxUrl).toBeNull();
		expect(body.project.previewUrl).toBeNull();
	});

	it("returns 404 for non-owner private project", async () => {
		getSessionFromReq.mockResolvedValue({ user: { id: "viewer" } });
		getProjectById.mockResolvedValue({
			projectId: "p1",
			visibility: "private",
			userId: "owner",
		});

		const { GET } = await import("../../app/api/projects/[projectId]/route");
		const response = await GET({} as NextRequest, {
			params: Promise.resolve({ projectId: "p1" }),
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Project not found" });
	});

	it("returns full project for owner", async () => {
		getSessionFromReq.mockResolvedValue({ user: { id: "owner" } });
		getProjectById.mockResolvedValue({
			projectId: "p1",
			visibility: "private",
			userId: "owner",
			sandboxId: "sbx_secret",
		});

		const { GET } = await import("../../app/api/projects/[projectId]/route");
		const response = await GET({} as NextRequest, {
			params: Promise.resolve({ projectId: "p1" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.project.sandboxId).toBe("sbx_secret");
	});
});
