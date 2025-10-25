import { NextResponse } from "next/server";
import { SUPPORTED_MODELS } from "@/lib/ai/constants";
import { getAvailableModels } from "@/lib/ai/gateway";

export async function GET() {
	const allModels = await getAvailableModels();
	return NextResponse.json({
		models: allModels.filter((model) => SUPPORTED_MODELS.includes(model.id)),
	});
}
