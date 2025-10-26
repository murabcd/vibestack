import type { NextRequest } from "next/server";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(req: NextRequest) {
	const session = await getSessionFromReq(req);

	return Response.json({ session });
}
