import { db } from "./index";
import { settings } from "./schema";
import { eq, and } from "drizzle-orm";
import { MAX_SANDBOX_DURATION } from "@/lib/constants";

/**
 * Get a setting value with fallback to default.
 * Returns user-specific setting if found, otherwise returns the default value.
 *
 * @param key - Setting key (e.g., 'maxSandboxDuration')
 * @param userId - User ID for user-specific settings
 * @param defaultValue - Default value if no user setting found
 * @returns The setting value as a string, or the default value
 */
export async function getSetting(
	key: string,
	userId: string | undefined,
	defaultValue?: string,
): Promise<string | undefined> {
	if (!userId) {
		return defaultValue;
	}

	const userSetting = await db
		.select()
		.from(settings)
		.where(and(eq(settings.userId, userId), eq(settings.key, key)))
		.limit(1);

	return userSetting[0]?.value ?? defaultValue;
}

/**
 * Get a numeric setting value (useful for maxSandboxDuration, etc.)
 *
 * @param key - Setting key
 * @param userId - User ID for user-specific settings
 * @param defaultValue - Default numeric value if no user setting found
 * @returns The setting value parsed as a number
 */
export async function getNumericSetting(
	key: string,
	userId: string | undefined,
	defaultValue?: number,
): Promise<number | undefined> {
	const value = await getSetting(key, userId, defaultValue?.toString());
	return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Get the max sandbox duration (in minutes) for a user.
 * Checks user-specific setting, then falls back to environment variable.
 *
 * @param userId - Optional user ID for user-specific duration
 * @returns The max sandbox duration in minutes
 */
export async function getMaxSandboxDuration(userId?: string): Promise<number> {
	const result = await getNumericSetting(
		"maxSandboxDuration",
		userId,
		MAX_SANDBOX_DURATION,
	);
	return result ?? MAX_SANDBOX_DURATION;
}

/**
 * Set a user setting value
 *
 * @param key - Setting key
 * @param value - Setting value
 * @param userId - User ID
 * @returns The created or updated setting
 */
export async function setSetting(
	key: string,
	value: string,
	userId: string,
): Promise<void> {
	// Check if setting already exists
	const existingSetting = await db
		.select()
		.from(settings)
		.where(and(eq(settings.userId, userId), eq(settings.key, key)))
		.limit(1);

	if (existingSetting[0]) {
		// Update existing setting
		await db
			.update(settings)
			.set({
				value,
				updatedAt: new Date(),
			})
			.where(and(eq(settings.userId, userId), eq(settings.key, key)));
	} else {
		// Create new setting
		await db.insert(settings).values({
			id: crypto.randomUUID(),
			userId,
			key,
			value,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}
}

