-- Application constraints and receipt isolation. Existing public content is preserved.
ALTER TABLE stg_private.receipts ADD CONSTRAINT receipt_business_rules CHECK (
  number BETWEEN 1 AND 999999 AND currency IN ('ARS', 'USD') AND amount > 0 AND exchange_rate > 0
  AND (currency <> 'ARS' OR exchange_rate = 1) AND total_ars = round(amount * exchange_rate, 2)
  AND passengers BETWEEN 1 AND 9999 AND length(trim(client)) BETWEEN 1 AND 80
  AND length(trim(reservation)) BETWEEN 1 AND 40 AND length(trim(destination)) BETWEEN 1 AND 160
  AND payment_method IN ('Transferencia','Efectivo','Tarjeta','Otro')
);
--> statement-breakpoint
ALTER TABLE stg_private.receipt_counter ADD CONSTRAINT receipt_counter_rules CHECK (id = 1 AND next_number BETWEEN 1 AND 1000000);
--> statement-breakpoint
CREATE INDEX receipt_created_at_idx ON stg_private.receipts (created_at DESC);
--> statement-breakpoint
CREATE INDEX receipt_share_expiry_idx ON stg_private.receipt_shares (expires_at);
--> statement-breakpoint
ALTER TABLE stg_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg_private.receipt_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg_private.receipt_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg_private.receipt_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA stg_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA stg_private FROM PUBLIC;
--> statement-breakpoint
-- The owner/server connection accesses these tables only after server-side Auth checks.
-- No Data API access to receipts, even when Supabase's public API is enabled.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA stg_private FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA stg_private FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA stg_private FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA stg_private FROM authenticated;
  END IF;
END $$;
--> statement-breakpoint
-- User requested that the new system begins at 000001. Never resets an existing counter.
INSERT INTO stg_private.receipt_counter (id, next_number, initialized) VALUES (1, 1, true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- Existing public tables keep their data; deny unintended direct API writes on fresh databases.
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
