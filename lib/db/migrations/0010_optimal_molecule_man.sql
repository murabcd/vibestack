CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "accounts_user_id_provider_idx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "access_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "username" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "provider" SET DEFAULT 'github';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "external_id" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "access_token" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "id_token" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refresh_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "accounts" (
	"id",
	"user_id",
	"provider",
	"external_user_id",
	"access_token",
	"refresh_token",
	"scope",
	"created_at",
	"updated_at"
)
SELECT
	'legacy_' || "id",
	"id",
	"provider",
	"external_id",
	"access_token",
	"refresh_token",
	"scope",
	"created_at",
	"updated_at"
FROM "users"
WHERE "provider" = 'github'
	AND "external_id" <> ''
	AND NOT EXISTS (
		SELECT 1
		FROM "accounts" AS "a"
		WHERE "a"."provider" = "users"."provider"
			AND "a"."external_user_id" = "users"."external_id"
	);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_identifier_value_idx" ON "verifications" USING btree ("identifier","value");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_external_user_id_idx" ON "accounts" USING btree ("provider","external_user_id");
