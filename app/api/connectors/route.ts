import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/index";
import { connectors } from "@/lib/db/schema";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import { getSessionFromReq } from "@/lib/session/server";

export async function GET(req: NextRequest) {
	const wide = createApiWideEvent(req, "connectors.list");
	try {
		const session = await getSessionFromReq(req);

		if (!session?.user?.id) {
			wide.end(401, "error", new Error("Unauthorized"));
			return NextResponse.json(
				{
					success: false,
					error: "Unauthorized",
					data: [],
				},
				{ status: 401 },
			);
		}

		const userConnectors = await db
			.select()
			.from(connectors)
			.where(eq(connectors.userId, session.user.id));
		wide.add({
			user_id: session.user.id,
			connector_count: userConnectors.length,
		});

		// Decrypt sensitive fields
		const decryptedConnectors = userConnectors.map((connector) => ({
			...connector,
			oauthClientSecret: connector.oauthClientSecret
				? decrypt(connector.oauthClientSecret)
				: null,
			env: connector.env ? JSON.parse(decrypt(connector.env)) : null,
		}));

		wide.end(200, "success");
		return NextResponse.json({
			success: true,
			data: decryptedConnectors,
		});
	} catch (error) {
		wide.end(500, "error", error);

		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch connectors",
				data: [],
			},
			{ status: 500 },
		);
	}
}
