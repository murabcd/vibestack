CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" text NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" text NOT NULL,
	"title" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"sandboxId" text,
	"sandboxUrl" text,
	"previewUrl" text,
	"status" varchar DEFAULT 'idle' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "projects_projectId_unique" UNIQUE("projectId")
);
