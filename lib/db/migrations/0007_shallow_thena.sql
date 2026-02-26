DELETE FROM "messages"
WHERE "projectId" NOT IN (SELECT "projectId" FROM "projects");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'messages_projectId_projects_projectId_fk'
	) THEN
		ALTER TABLE "messages"
		ADD CONSTRAINT "messages_projectId_projects_projectId_fk"
		FOREIGN KEY ("projectId")
		REFERENCES "public"."projects"("projectId")
		ON DELETE cascade
		ON UPDATE no action;
	END IF;
END
$$;
