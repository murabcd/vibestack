import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";

export async function POST(): Promise<Response> {
	const store = await cookies();

	// Clear session cookie
	store.delete(SESSION_COOKIE_NAME);

	return Response.json({ success: true });
}
