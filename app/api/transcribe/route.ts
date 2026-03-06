import { createOpenAI } from "@ai-sdk/openai";
import {
	NoTranscriptGeneratedError,
	experimental_transcribe as transcribe,
} from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSessionFromReq } from "@/lib/session/server";

const openai = createOpenAI({
	apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
	try {
		const session = await getSessionFromReq(request);
		if (!session) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 },
			);
		}

		if (!env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "OPENAI_API_KEY is not configured" },
				{ status: 503 },
			);
		}

		const formData = await request.formData();
		const audio = formData.get("audio");
		if (!(audio instanceof File)) {
			return NextResponse.json(
				{ error: "Audio file is required" },
				{ status: 400 },
			);
		}
		if (audio.size < 1024) {
			return NextResponse.json({ text: "" });
		}

		const result = await transcribe({
			model: openai.transcription("gpt-4o-mini-transcribe"),
			audio: new Uint8Array(await audio.arrayBuffer()),
		});

		return NextResponse.json({ text: result.text ?? "" });
	} catch (error) {
		if (NoTranscriptGeneratedError.isInstance(error)) {
			return NextResponse.json({ text: "" });
		}
		console.error("Transcription request failed", error);
		return NextResponse.json(
			{ error: "Failed to transcribe audio" },
			{ status: 500 },
		);
	}
}
