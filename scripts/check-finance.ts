import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { presetRange } from "../src/features/finance/domain";
import { getStatistics } from "../src/server/finance/service";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: "require",
  prepare: false,
  connect_timeout: 10,
});
try {
  const statistics = await getStatistics(drizzle(client), {
    ...presetRange("year"),
    group: "auto",
  });
  const Money = Decimal.clone({ precision: 40 });
  assert.ok(
    new Money(statistics.income)
      .minus(statistics.expenses)
      .eq(statistics.balance),
  );
  assert.ok(statistics.points.length > 0);
  console.log(
    "Estadísticas verificadas mediante Drizzle en la base configurada. Saldo y períodos coherentes. Consulta de solo lectura; no se muestran importes ni credenciales.",
  );
} catch {
  console.error(
    "No se pudo verificar estadísticas. Revisá la conexión y las migraciones.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
