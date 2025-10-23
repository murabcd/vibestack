import { cookies } from "next/headers";
import { getHorizontal } from "@/components/layout/sizing";
import { PageClient } from "@/app/page-client";

export default async function Page() {
	const store = await cookies();
	const horizontalSizes = getHorizontal(store);
	return <PageClient horizontalSizes={horizontalSizes ?? []} />;
}
