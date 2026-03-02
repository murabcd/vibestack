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
}));

vi.mock("@/lib/session/server", () => ({
	getSessionFromReq,
}));

vi.mock("@/lib/logging/wide-event", () => ({
	createApiWideEvent,
}));

vi.mock("@vercel/sandbox", () => ({
	Sandbox: {
		get: vi.fn(),
	},
}));

describe("projects/[projectId]/github/source GET", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getSessionFromReq.mockResolvedValue({ user: { id: "user_1" } });
	});

	it("returns imported metadata when sandbox is absent", async () => {
		getProjectById.mockResolvedValue({
			projectId: "p1",
			userId: "user_1",
			sandboxId: null,
			githubMetadata: {
				source: {
					provider: "github",
					owner: "owner",
					repo: "repo",
					fullName: "owner/repo",
					defaultBranch: "main",
					importedAt: "2026-03-02T00:00:00.000Z",
				},
				workingBranch: "vibestack/branch-1",
				lastPullRequest: {
					number: 12,
					url: "https://github.com/owner/repo/pull/12",
					branch: "vibestack/branch-1",
					baseBranch: "main",
					title: "Update repo",
					createdAt: "2026-03-02T00:00:00.000Z",
				},
			},
		});

		const { GET } = await import(
			"../../app/api/projects/[projectId]/github/source/route"
		);
		const response = await GET({} as NextRequest, {
			params: Promise.resolve({ projectId: "p1" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.imported).toBe(true);
		expect(body.repository.fullName).toBe("owner/repo");
		expect(body.lastPullRequest.number).toBe(12);
	});

	it("returns imported false when no source metadata and no sandbox", async () => {
		getProjectById.mockResolvedValue({
			projectId: "p1",
			userId: "user_1",
			sandboxId: null,
			githubMetadata: null,
		});

		const { GET } = await import(
			"../../app/api/projects/[projectId]/github/source/route"
		);
		const response = await GET({} as NextRequest, {
			params: Promise.resolve({ projectId: "p1" }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ imported: false });
	});
});
