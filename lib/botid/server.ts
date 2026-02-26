import { checkBotId } from "botid/server";

/**
 * In local development, bypass BotID classification to avoid noisy warnings
 * and always treat requests as human.
 */
export function checkBotIdForRequest() {
	if (process.env.NODE_ENV !== "production") {
		return checkBotId({
			developmentOptions: {
				bypass: "HUMAN",
			},
		});
	}

	return checkBotId();
}
