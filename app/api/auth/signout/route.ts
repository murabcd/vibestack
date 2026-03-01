import { auth } from "@/lib/auth/better-auth";

export async function POST(request: Request): Promise<Response> {
	return auth.api.signOut({
		headers: new Headers(request.headers),
		asResponse: true,
	});
}
