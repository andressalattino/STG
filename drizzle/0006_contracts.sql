CREATE TABLE "stg_private"."contract_counter" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."contract_counter" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_private"."contract_documents" (
	"contract_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"sha256" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stg_private"."contract_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_private"."contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"version" integer NOT NULL,
	"previous_id" uuid,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"destination" text NOT NULL,
	"passenger_names" text NOT NULL,
	"passenger_dnis" text NOT NULL,
	"data" jsonb NOT NULL,
	"template_version" text DEFAULT 'v1' NOT NULL,
	CONSTRAINT "contracts_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "contract_number_version_rules" CHECK ("stg_private"."contracts"."number" between 1 and 999999 and "stg_private"."contracts"."version" between 1 and 9999 and (("stg_private"."contracts"."version" = 1 and "stg_private"."contracts"."previous_id" is null) or ("stg_private"."contracts"."version" > 1 and "stg_private"."contracts"."previous_id" is not null)))
);
--> statement-breakpoint
ALTER TABLE "stg_private"."contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stg_private"."contract_documents" ADD CONSTRAINT "contract_documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "stg_private"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_number_version_idx" ON "stg_private"."contracts" USING btree ("number","version");--> statement-breakpoint
CREATE INDEX "contract_previous_idx" ON "stg_private"."contracts" USING btree ("previous_id");
--> statement-breakpoint
REVOKE ALL ON stg_private.contract_counter, stg_private.contracts, stg_private.contract_documents FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
INSERT INTO stg_private.contract_counter (id, next_number) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
