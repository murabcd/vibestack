import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

if (!env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required.");
}
const client = postgres(env.DATABASE_URL, {
	prepare: false,
});
export const db = drizzle(client);
