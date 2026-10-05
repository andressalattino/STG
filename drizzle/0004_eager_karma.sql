CREATE TABLE "stg_private"."expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"paid_on" date NOT NULL,
	"payee" text NOT NULL,
	"concept" text NOT NULL,
	"category" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"exchange_rate" numeric(14, 6) NOT NULL,
	"total_ars" numeric(18, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	CONSTRAINT "expenses_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "expense_money_rules" CHECK ("stg_private"."expenses"."currency" in ('ARS','USD') and "stg_private"."expenses"."amount" > 0 and "stg_private"."expenses"."exchange_rate" > 0 and ("stg_private"."expenses"."currency" <> 'ARS' or "stg_private"."expenses"."exchange_rate" = 1) and "stg_private"."expenses"."total_ars" = round("stg_private"."expenses"."amount" * "stg_private"."expenses"."exchange_rate", 2)),
	CONSTRAINT "expense_text_rules" CHECK (length(trim("stg_private"."expenses"."payee")) between 1 and 120 and length(trim("stg_private"."expenses"."concept")) between 1 and 200),
	CONSTRAINT "expense_void_rules" CHECK (("stg_private"."expenses"."voided_at" is null and "stg_private"."expenses"."voided_by" is null and "stg_private"."expenses"."void_reason" is null) or ("stg_private"."expenses"."voided_at" is not null and "stg_private"."expenses"."voided_by" is not null and "stg_private"."expenses"."void_reason" is not null and length(trim("stg_private"."expenses"."void_reason")) between 3 and 300))
);
--> statement-breakpoint
ALTER TABLE "stg_private"."expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "expense_paid_on_idx" ON "stg_private"."expenses" USING btree ("paid_on");
--> statement-breakpoint
REVOKE ALL ON TABLE stg_private.expenses FROM PUBLIC, anon, authenticated;
