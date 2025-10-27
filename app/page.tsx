import { cookies } from "next/headers";
import { PageClient } from "@/app/page-client";
import { MAX_SANDBOX_DURATION } from "@/lib/constants";

export default async function Page() {
	const cookieStore = await cookies();
	const modelIdFromCookie = cookieStore.get("selected-model")?.value;
	const sandboxDurationFromCookie = cookieStore.get("sandbox-duration")?.value;
	const initialSandboxDuration = sandboxDurationFromCookie
		? parseInt(sandboxDurationFromCookie, 10)
		: MAX_SANDBOX_DURATION;

	return (
		<PageClient
			initialSandboxDuration={initialSandboxDuration}
			initialModelId={modelIdFromCookie}
		/>
	);
}
