import { type NextRequest, NextResponse } from "next/server";
import { getProjectBySandboxId } from "@/lib/db/queries";
import { getSessionFromReq } from "@/lib/session/server";

export async function authorizeSandboxOwner(
	request: NextRequest,
	sandboxId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
	const session = await getSessionFromReq(request);
	if (!session?.user?.id) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			),
		};
	}

	const project = await getProjectBySandboxId(sandboxId);
	if (!project || project.userId !== session.user.id) {
		return {
			ok: false,
			response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { ok: true };
}
