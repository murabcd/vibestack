import { checkBotId } from "botid/server";
import { type NextRequest, NextResponse } from "next/server";

type BotIdCheckResult = Awaited<ReturnType<typeof checkBotId>>;

/**
 * In local development, bypass BotID classification to avoid noisy warnings
 * and always treat requests as human.
 */
export async function checkBotIdForRequest(): Promise<BotIdCheckResult> {
	if (process.env.NODE_ENV !== "production") {
		return {
			isHuman: true,
			isBot: false,
			isVerifiedBot: false,
			bypassed: true,
		} as BotIdCheckResult;
	}

	return checkBotId();
}

type BotIdWideEvent = {
	add?: (fields: Record<string, unknown>) => void;
	end?: (
		statusCode: number,
		outcome: "success" | "error",
		error?: unknown,
		extra?: Record<string, unknown>,
	) => void;
};

export async function rejectBotRequest(
	_request: Request | NextRequest,
	wide?: BotIdWideEvent,
) {
	const checkResult = await checkBotIdForRequest();
	const checkResultWithLegacy = checkResult as typeof checkResult & {
		isGoodBot?: boolean;
		isVerifiedBot?: boolean;
	};
	const isVerifiedBot =
		checkResultWithLegacy.isVerifiedBot ??
		checkResultWithLegacy.isGoodBot ??
		false;

	wide?.add?.({
		botid_is_bot: checkResult.isBot,
		botid_is_verified_bot: isVerifiedBot,
		botid_bypassed: checkResult.bypassed,
	});

	if (!checkResult.isBot) {
		return null;
	}

	wide?.end?.(403, "error", new Error("Bot detected"));
	return NextResponse.json({ error: "Bot detected" }, { status: 403 });
}
