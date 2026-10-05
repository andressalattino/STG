import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const globalDb = globalThis as unknown as {
  stgSql?: ReturnType<typeof postgres>;
};
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_MISSING");
  const client =
    globalDb.stgSql ??
    postgres(url, {
      max: 3,
      prepare: false,
      ssl: "require",
      connect_timeout: 10,
      idle_timeout: 20,
    });
  globalDb.stgSql = client;
  return drizzle(client);
}
