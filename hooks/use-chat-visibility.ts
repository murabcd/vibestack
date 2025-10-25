import { useState } from "react";

type VisibilityType = "public" | "private";

export function useChatVisibility({
	initialVisibility = "private",
}: {
	chatId: string;
	initialVisibility?: VisibilityType;
}) {
	const [visibilityType, setVisibilityType] =
		useState<VisibilityType>(initialVisibility);

	return {
		visibilityType,
		setVisibilityType,
	};
}
