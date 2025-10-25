import { useState } from "react";
import type { VisibilityType } from "@/lib/mock-data/chats";

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
