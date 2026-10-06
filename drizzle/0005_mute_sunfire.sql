CREATE TABLE "stg_private"."quotation_counter" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."quotation_counter" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_private"."quotation_documents" (
	"quotation_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"sha256" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."quotation_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_private"."quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"passenger" text NOT NULL,
	"destination" text NOT NULL,
	"data" jsonb NOT NULL,
	"template_version" text DEFAULT 'v1' NOT NULL,
	CONSTRAINT "quotations_number_unique" UNIQUE("number"),
	CONSTRAINT "quotations_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "quotation_number_positive" CHECK ("stg_private"."quotations"."number" between 1 and 999999)
);
--> statement-breakpoint
ALTER TABLE "stg_private"."quotations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stg_private"."quotation_documents" ADD CONSTRAINT "quotation_documents_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "stg_private"."quotations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON stg_private.quotation_counter, stg_private.quotations, stg_private.quotation_documents FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
INSERT INTO stg_private.quotation_counter (id, next_number) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
