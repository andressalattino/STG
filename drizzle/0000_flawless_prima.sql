CREATE SCHEMA IF NOT EXISTS "stg_private";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trip" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "passenger_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg_private"."receipt_counter" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_number" integer NOT NULL,
	"initialized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg_private"."receipt_documents" (
	"receipt_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"sha256" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg_private"."receipt_shares" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"receipt_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg_private"."receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"client" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"exchange_rate" numeric(14, 6) NOT NULL,
	"total_ars" numeric(18, 2) NOT NULL,
	"reservation" text NOT NULL,
	"passengers" integer NOT NULL,
	"travel_date" date NOT NULL,
	"destination" text NOT NULL,
	"payment_method" text NOT NULL,
	"rate_source" text NOT NULL,
	"quote_updated_at" timestamp with time zone,
	"template_version" text DEFAULT 'v1' NOT NULL,
	CONSTRAINT "receipts_number_unique" UNIQUE("number"),
	CONSTRAINT "receipts_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"pdf_url" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."receipt_documents" ADD CONSTRAINT "receipt_documents_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "stg_private"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_private"."receipt_shares" ADD CONSTRAINT "receipt_shares_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "stg_private"."receipts"("id") ON DELETE no action ON UPDATE no action;