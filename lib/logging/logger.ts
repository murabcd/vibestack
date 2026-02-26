type LogLevel = "info" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, payload: LogPayload) {
	const entry = {
		level,
		...payload,
	};

	const line = JSON.stringify(entry);
	if (level === "error") {
		console.error(line);
		return;
	}
	console.log(line);
}

export const logger = {
	info(payload: LogPayload) {
		emit("info", payload);
	},
	error(payload: LogPayload) {
		emit("error", payload);
	},
};
