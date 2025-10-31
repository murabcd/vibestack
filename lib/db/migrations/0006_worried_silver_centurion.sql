ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "type" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "type" SET DEFAULT 'remote';--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "status" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "connectors" ALTER COLUMN "status" SET DEFAULT 'disconnected';