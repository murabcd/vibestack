import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createProject = vi.fn();
const updateProject = vi.fn();
const getSessionFromReq = vi.fn();
const getOAuthToken = vi.fn();
const createApiWideEvent = vi.fn(() => ({
	add: vi.fn(),
	end: vi.fn(),
}));

const sandboxRunCommand = vi.fn();

vi.mock("@/lib/db/queries", () => ({
	createProject,
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
		create: vi.fn(async () => ({
			sandboxId: "sbx_1",
			domain: vi.fn(() => "https://preview.example"),
			runCommand: sandboxRunCommand,
		})),
	},
}));

describe("projects/import/github POST", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createProject.mockResolvedValue({});
		updateProject.mockResolvedValue({});
		getSessionFromReq.mockResolvedValue({ user: { id: "user_1" } });
		getOAuthToken.mockResolvedValue({ accessToken: "gho_test" });
		sandboxRunCommand
			.mockResolvedValueOnce({
				stdout: vi.fn(async () => "README.md\npackage.json\n"),
				stderr: vi.fn(async () => ""),
				wait: vi.fn(async () => ({ exitCode: 0 })),
			})
			.mockResolvedValueOnce({
				stdout: vi.fn(async () => "main\n"),
			})
			.mockResolvedValueOnce({
				cmdId: "cmd_1",
			});
	});

	it("returns 401 when GitHub token is missing", async () => {
		getOAuthToken.mockResolvedValueOnce(null);
		const { POST } = await import("../../app/api/projects/import/github/route");
		const response = await POST({
			json: async () => ({ repository: "owner/repo", visibility: "private" }),
		} as NextRequest);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "GitHub account is not connected",
		});
	});

	it("stores source repository metadata after successful import", async () => {
		const { POST } = await import("../../app/api/projects/import/github/route");
		const response = await POST({
			json: async () => ({ repository: "owner/repo", visibility: "private" }),
		} as NextRequest);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(updateProject).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				githubMetadata: expect.objectContaining({
					source: expect.objectContaining({
						fullName: "owner/repo",
						defaultBranch: "main",
					}),
				}),
			}),
		);
	});
});
