import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_MISSING");
const db = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});
try {
  const [state] = await db`select
    (select count(*)::int from stg_private.receipts) as receipts,
    (select count(*)::int from stg_private.receipt_documents) as documents,
    (select next_number from stg_private.receipt_counter where id=1) as next_number,
    (select md5(coalesce(string_agg(sha256 || receipt_id::text, ',' order by receipt_id),'')) from stg_private.receipt_documents) as documents_fingerprint,
    exists(select 1 from information_schema.columns where table_schema='stg_private' and table_name='receipts' and column_name='payments') as payments_column,
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='stg_private' and c.relname='receipts') as rls,
    has_table_privilege('anon','stg_private.receipts','SELECT') as anon_select,
    has_table_privilege('authenticated','stg_private.receipts','SELECT') as authenticated_select`;
  console.log(JSON.stringify(state));
  if (state.payments_column) {
    const [detail] =
      await db`select count(*)::int as receipts_with_payments from stg_private.receipts where jsonb_array_length(payments)>0`;
    console.log(JSON.stringify(detail));
  }
} catch {
  console.error(
    "No se pudo comprobar la base de recibos. No se modificó ningún dato.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
