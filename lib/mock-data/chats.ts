import { subDays, subMonths } from "date-fns";

export type VisibilityType = "private" | "public";

export type Chat = {
	_id: string;
	_creationTime: number;
	title: string;
	visibility: VisibilityType;
	chatId: string;
	userId: string;
	isPinned?: boolean;
	createdAt: number;
};

// Generate mock chat data with varied dates
const generateMockChats = (): Chat[] => {
	const now = new Date();
	const chats: Chat[] = [];

	// Today's chats (3 chats)
	for (let i = 0; i < 3; i++) {
		const hoursAgo = Math.floor(Math.random() * 24);
		const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

		chats.push({
			_id: `chat-today-${i}`,
			_creationTime: createdAt.getTime(),
			title: `Today's Chat ${i + 1}`,
			visibility: Math.random() > 0.5 ? "public" : "private",
			chatId: `today-${i}`,
			userId: "user-1",
			isPinned: i === 0, // First chat is pinned
			createdAt: createdAt.getTime(),
		});
	}

	// Yesterday's chats (4 chats)
	for (let i = 0; i < 4; i++) {
		const hoursAgo = 24 + Math.floor(Math.random() * 24);
		const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

		chats.push({
			_id: `chat-yesterday-${i}`,
			_creationTime: createdAt.getTime(),
			title: `Yesterday's Chat ${i + 1}`,
			visibility: Math.random() > 0.5 ? "public" : "private",
			chatId: `yesterday-${i}`,
			userId: "user-1",
			isPinned: i === 1, // Second chat is pinned
			createdAt: createdAt.getTime(),
		});
	}

	// Last week's chats (5 chats)
	for (let i = 0; i < 5; i++) {
		const daysAgo = 2 + Math.floor(Math.random() * 5);
		const createdAt = subDays(now, daysAgo);

		chats.push({
			_id: `chat-week-${i}`,
			_creationTime: createdAt.getTime(),
			title: `Last Week Chat ${i + 1}`,
			visibility: Math.random() > 0.5 ? "public" : "private",
			chatId: `week-${i}`,
			userId: "user-1",
			isPinned: false,
			createdAt: createdAt.getTime(),
		});
	}

	// Last month's chats (6 chats)
	for (let i = 0; i < 6; i++) {
		const daysAgo = 7 + Math.floor(Math.random() * 23);
		const createdAt = subDays(now, daysAgo);

		chats.push({
			_id: `chat-month-${i}`,
			_creationTime: createdAt.getTime(),
			title: `Last Month Chat ${i + 1}`,
			visibility: Math.random() > 0.5 ? "public" : "private",
			chatId: `month-${i}`,
			userId: "user-1",
			isPinned: false,
			createdAt: createdAt.getTime(),
		});
	}

	// Older chats (8 chats)
	for (let i = 0; i < 8; i++) {
		const monthsAgo = 1 + Math.floor(Math.random() * 6);
		const createdAt = subMonths(now, monthsAgo);

		chats.push({
			_id: `chat-older-${i}`,
			_creationTime: createdAt.getTime(),
			title: `Older Chat ${i + 1}`,
			visibility: Math.random() > 0.5 ? "public" : "private",
			chatId: `older-${i}`,
			userId: "user-1",
			isPinned: false,
			createdAt: createdAt.getTime(),
		});
	}

	// Sort by creation time (newest first)
	return chats.sort((a, b) => b._creationTime - a._creationTime);
};

export const mockChats = generateMockChats();
