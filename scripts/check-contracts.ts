import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});
try {
  const [row] = await client`select
    (select count(*)::int from stg_private.contracts) as versions,
    (select count(*)::int from stg_private.contract_documents) as documents,
    (select next_number from stg_private.contract_counter where id=1) as next_number,
    (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='stg_private' and c.relname in ('contracts','contract_documents','contract_counter')) as rls,
    (select count(*)::int from information_schema.table_privileges where table_schema='stg_private' and table_name in ('contracts','contract_documents','contract_counter') and grantee in ('anon','authenticated','PUBLIC')) as public_grants`;
  if (
    row.versions !== row.documents ||
    !row.rls ||
    row.public_grants !== 0 ||
    !row.next_number
  )
    throw new Error("CONTRACT_CHECK_FAILED");
  console.log(
    `Contratos: ${row.versions} versiones, ${row.documents} PDF. Próximo número: ${String(row.next_number).padStart(6, "0")}. RLS activo y sin permisos públicos. Verificación de solo lectura.`,
  );
} finally {
  await client.end();
}
