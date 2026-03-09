import { generateObject } from "ai";
import { jsonrepair } from "jsonrepair";
import { NextResponse } from "next/server";
import { linesSchema, resultSchema } from "@/components/error-monitor/schemas";
import { Models } from "@/lib/ai/constants";
import { getModelOptions } from "@/lib/ai/gateway";
import { rejectBotRequest } from "@/lib/botid/server";
import { createApiWideEvent } from "@/lib/logging/wide-event";
import prompt from "./prompt.md";

export async function POST(req: Request) {
	const wide = createApiWideEvent(req, "errors.summarize");
	const [botResponse, body] = await Promise.all([
		rejectBotRequest(req, wide),
		req.json(),
	]);
	if (botResponse) {
		return botResponse;
	}

	const parsedBody = linesSchema.safeParse(body);
	if (!parsedBody.success) {
		wide.end(400, "error", new Error("Invalid request body"));
		return NextResponse.json({ error: `Invalid request` }, { status: 400 });
	}

	const { model, providerOptions } = getModelOptions(Models.OpenAIGpt52);

	const result = await generateObject({
		system: prompt,
		model,
		providerOptions,
		messages: [{ role: "user", content: JSON.stringify(parsedBody.data) }],
		schema: resultSchema,
		experimental_repairText: async ({ text }) => {
			try {
				return jsonrepair(text);
			} catch {
				return text; // Return original if repair fails
			}
		},
	});

	wide.add({
		model_id: Models.OpenAIGpt52,
		error_lines: parsedBody.data.lines.length,
	});
	wide.end(200, "success");
	return NextResponse.json(result.object, {
		status: 200,
	});
}
