import type { initBotId } from "botid/client/core";

export const protectedBotIdRoutes = [
	{
		path: "/api/chat",
		method: "POST",
	},
	{
		path: "/api/errors",
		method: "POST",
	},
	{
		path: "/api/transcribe",
		method: "POST",
	},
	{
		path: "/api/projects/import/github",
		method: "POST",
	},
	{
		path: "/api/projects/*/github/create-pr",
		method: "POST",
	},
	{
		path: "/api/projects/*/publish/github",
		method: "POST",
	},
	{
		path: "/api/projects/*/github/sync",
		method: "POST",
	},
	{
		path: "/api/sandboxes/*/control",
		method: "POST",
	},
	{
		path: "/api/sandboxes/*/files",
		method: "POST",
	},
] satisfies Parameters<typeof initBotId>[0]["protect"];
