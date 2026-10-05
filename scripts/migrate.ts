import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Falta DATABASE_URL en .env.local. Copiá la conexión Session pooler desde Supabase → Connect.",
  );
  process.exit(1);
}
const client = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(
    "Migraciones aplicadas. El sistema nuevo comienza en 000001; los datos existentes se conservaron.",
  );
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  console.error(
    `No se pudo aplicar la migración (${code}). Revisá las credenciales, la conexión y el esquema existente.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
