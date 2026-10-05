import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const start = Number(process.argv[2]);
if (
  !Number.isInteger(start) ||
  start < 1 ||
  start > 999999 ||
  !process.env.DATABASE_URL
) {
  console.error(
    "Uso: npm run db:numbering -- NUMERO (con DATABASE_URL configurada)",
  );
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: "require",
  prepare: false,
});
try {
  await client.begin(async (tx) => {
    await tx`select * from stg_private.receipt_counter where id=1 for update`;
    const [row] =
      await tx`select count(*)::int as count from stg_private.receipts`;
    if (row.count)
      throw new Error(
        "Ya hay recibos emitidos; no se puede cambiar la numeración.",
      );
    await tx`update stg_private.receipt_counter set next_number=${start}, initialized=true where id=1`;
  });
  console.log(`Primer número configurado: ${String(start).padStart(6, "0")}`);
} catch {
  console.error(
    "No se pudo cambiar la numeración. Comprobá la conexión y que no haya recibos emitidos.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
