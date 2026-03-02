import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProjectById = vi.fn();
const updateProject = vi.fn();
const getSessionFromReq = vi.fn();
const getOAuthToken = vi.fn();
const createApiWideEvent = vi.fn(() => ({
	add: vi.fn(),
	end: vi.fn(),
}));
const sandboxRunCommand = vi.fn();

vi.mock("@/lib/db/queries", () => ({
	getProjectById,
	updateProject,
}));

vi.mock("@/lib/session/server", () => ({
	getSessionFromReq,
}));

vi.mock("@/lib/session/get-oauth-token", () => ({
	getOAuthToken,
}));

vi.mock("@/lib/logging/wide-event", () => ({
	createApiWideEvent,
}));

vi.mock("@/lib/sandbox/config", () => ({
	getSandboxConfig: vi.fn(() => ({
		teamId: "team",
		projectId: "project",
		token: "token",
	})),
}));

vi.mock("@vercel/sandbox", () => ({
	Sandbox: {
		get: vi.fn(async () => ({
			runCommand: sandboxRunCommand,
		})),
	},
}));

describe("projects/[projectId]/github/create-pr POST", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getSessionFromReq.mockResolvedValue({
			user: { id: "user_1", name: "Murad", email: "murad@example.com" },
		});
		getOAuthToken.mockResolvedValue({ accessToken: "gho_test" });
		getProjectById.mockResolvedValue({
			projectId: "p1",
			title: "My app",
			userId: "user_1",
			sandboxId: "sbx_1",
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
			},
		});
		updateProject.mockResolvedValue({});
		sandboxRunCommand
			.mockResolvedValueOnce({
				stdout: vi.fn(async () => "https://github.com/owner/repo.git\n"),
			})
			.mockResolvedValueOnce({
				stdout: vi.fn(async () => "main\n"),
			})
			.mockResolvedValueOnce({
				stdout: vi.fn(async () => ""),
				stderr: vi.fn(async () => ""),
				wait: vi.fn(async () => ({ exitCode: 0 })),
			});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 201,
				json: async () => ({
					html_url: "https://github.com/owner/repo/pull/1",
					number: 1,
					head: { ref: "vibestack/branch-1" },
					base: { ref: "main" },
				}),
			})),
		);
	});

	it("creates PR and persists PR metadata", async () => {
		const { POST } = await import(
			"../../app/api/projects/[projectId]/github/create-pr/route"
		);

		const response = await POST(
			{
				json: async () => ({ title: "Update app", body: "Changes" }),
			} as NextRequest,
			{ params: Promise.resolve({ projectId: "p1" }) },
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.pullRequest.number).toBe(1);
		expect(updateProject).toHaveBeenCalledWith(
			"p1",
			expect.objectContaining({
				githubMetadata: expect.objectContaining({
					lastPullRequest: expect.objectContaining({
						number: 1,
					}),
				}),
			}),
		);
	});
});
