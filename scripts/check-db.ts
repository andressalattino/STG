import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Consultá SUPABASE_SETUP.md.");
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: "require",
  prepare: false,
  connect_timeout: 10,
});
try {
  const [counter] =
    await client`select next_number, initialized from stg_private.receipt_counter where id=1`;
  const [counts] = await client`select
    (select count(*) from stg_private.receipts)::int as receipts,
    (select count(*) from stg_private.receipt_documents)::int as documents,
    (select count(*) from public.app_admins)::int as admins`;
  if (!counter?.initialized) throw new Error("COUNTER_MISSING");
  if (counts.receipts !== counts.documents)
    throw new Error("DOCUMENT_COUNT_MISMATCH");
  console.log(
    `Conexión correcta. Recibos: ${counts.receipts}. Próximo número: ${String(counter.next_number).padStart(6, "0")}. Administradores: ${counts.admins}.`,
  );
  if (!counts.admins)
    console.log("Falta habilitar un administrador según SUPABASE_SETUP.md.");
} catch {
  console.error(
    "No se pudo verificar la base. Revisá la conexión y ejecutá npm run db:migrate. No se modificó ningún dato.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
