CREATE TABLE "stg_private"."flyers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."flyers" ENABLE ROW LEVEL SECURITY;