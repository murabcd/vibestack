import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProjectById = vi.fn();
const getSessionFromReq = vi.fn();
const getOAuthToken = vi.fn();
const createApiWideEvent = vi.fn(() => ({
	add: vi.fn(),
	end: vi.fn(),
}));
const sandboxRunCommand = vi.fn();

vi.mock("@/lib/db/queries", () => ({
	getProjectById,
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

describe("projects/[projectId]/publish/github POST", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getSessionFromReq.mockResolvedValue({ user: { id: "user_1" } });
		getOAuthToken.mockResolvedValue({ accessToken: "gho_test" });
		getProjectById.mockResolvedValue({
			projectId: "p1",
			title: "App",
			userId: "user_1",
			sandboxId: "sbx_1",
		});
		sandboxRunCommand.mockResolvedValue({
			stdout: vi.fn(async () => ""),
			wait: vi.fn(async () => ({ exitCode: 0 })),
		});
	});

	it("creates a private repo when visibility is private", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 201,
			json: async () => ({
				name: "my-app",
				full_name: "user/my-app",
				html_url: "https://github.com/user/my-app",
				default_branch: "main",
				owner: { login: "user" },
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const { POST } = await import(
			"../../app/api/projects/[projectId]/publish/github/route"
		);
		await POST(
			{
				json: async () => ({
					repositoryName: "my-app",
					visibility: "private",
				}),
			} as NextRequest,
			{ params: Promise.resolve({ projectId: "p1" }) },
		);

		const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } })
			.mock.calls;
		const options = (calls[0]?.[1] ?? {}) as RequestInit;
		const payload = JSON.parse(String(options.body)) as { private: boolean };
		expect(payload.private).toBe(true);
	});

	it("creates a public repo when visibility is public", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 201,
			json: async () => ({
				name: "my-app",
				full_name: "user/my-app",
				html_url: "https://github.com/user/my-app",
				default_branch: "main",
				owner: { login: "user" },
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const { POST } = await import(
			"../../app/api/projects/[projectId]/publish/github/route"
		);
		await POST(
			{
				json: async () => ({
					repositoryName: "my-app",
					visibility: "public",
				}),
			} as NextRequest,
			{ params: Promise.resolve({ projectId: "p1" }) },
		);

		const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } })
			.mock.calls;
		const options = (calls[0]?.[1] ?? {}) as RequestInit;
		const payload = JSON.parse(String(options.body)) as { private: boolean };
		expect(payload.private).toBe(false);
	});
});
