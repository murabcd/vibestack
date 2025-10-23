import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { generateObject } from "ai";
import { linesSchema, resultSchema } from "@/components/error-monitor/schemas";
import { getModelOptions } from "@/lib/ai/gateway";
import { Models } from "@/lib/ai/constants";
import { jsonrepair } from "jsonrepair";
import prompt from "./prompt.md";

export async function POST(req: Request) {
	const checkResult = await checkBotId();
	if (checkResult.isBot) {
		return NextResponse.json({ error: `Bot detected` }, { status: 403 });
	}

	const body = await req.json();
	const parsedBody = linesSchema.safeParse(body);
	if (!parsedBody.success) {
		return NextResponse.json({ error: `Invalid request` }, { status: 400 });
	}

	const { model, providerOptions } = getModelOptions(
		Models.AnthropicClaude45Haiku,
		{
			reasoningEffort: "minimal",
		},
	);

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

	return NextResponse.json(result.object, {
		status: 200,
	});
}
