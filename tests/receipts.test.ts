import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { PDFDocument } from "pdf-lib";
import { receiptCounter, receiptDocuments, receipts } from "../src/db/schema";
import {
  calculateTotal,
  decimalDisplay,
  issuedDate,
  issuedTime,
  receiptFilename,
  receiptInputSchema,
} from "../src/features/receipts/domain";
import { issueReceipt } from "../src/server/receipts/service";

const input = (overrides: Record<string, unknown> = {}) =>
  receiptInputSchema.parse({
    requestId: randomUUID(),
    client: "Cliente de prueba",
    currency: "USD",
    amount: "10",
    exchangeRate: "1540",
    reservation: "00125",
    passengers: 2,
    travelDate: "2027-02-21",
    destination: "Bariloche",
    paymentMethod: "Transferencia",
    rateSource: "manual",
    ...overrides,
  });

test("decimal amounts, ARS normalization, precision and validation", () => {
  assert.equal(calculateTotal("10", "1540"), "15400.00");
  assert.equal(calculateTotal("0.01", "1.5"), "0.02");
  assert.equal(calculateTotal("0,1", "0,2"), "0.02");
  assert.equal(
    decimalDisplay("1234567890123456.78"),
    "1.234.567.890.123.456,78",
  );
  assert.equal(
    input({ currency: "ARS", exchangeRate: "999" }).exchangeRate,
    "1.000000",
  );
  assert.equal(input({ amount: "10,50" }).amount, "10.50");
  for (const invalid of [
    { amount: "-1" },
    { amount: "0" },
    { amount: "1.234,56" },
    { amount: "1.001" },
    { passengers: 0 },
    { passengers: 1.5 },
    { travelDate: "2026-02-30" },
    { client: " " },
    { currency: "EUR" },
    { exchangeRate: "0" },
  ])
    assert.throws(() => input(invalid));
});
test("Argentina date/time and safe filename", () => {
  assert.equal(issuedDate("2026-10-02T01:30:00Z"), "01/10/2026");
  assert.equal(issuedTime("2026-10-02T01:30:00Z"), "22:30");
  assert.equal(
    receiptFilename({ number: 1, client: "José Pérez / A" }),
    "Recibo_000001_Jose_Perez_A.pdf",
  );
});
test("database issuance is atomic, numbered, immutable and idempotent", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  // Minimal Supabase-managed schemas let the local test execute our Storage policies too.
  await client.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
  `);
  // Exercise the same migrations and transactional service against real PostgreSQL (WASM), not mocked queries.
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string }[] };
  for (const entry of journal.entries) {
    const migration = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    for (const statement of migration.split("--> statement-breakpoint"))
      if (statement.trim()) await client.exec(statement);
  }
  const serviceDb = db as unknown as Parameters<typeof issueReceipt>[0];
  const userId = randomUUID();
  try {
    await client.exec("SET ROLE anon");
    await assert.rejects(
      client.query("SELECT * FROM stg_private.receipts"),
      /permission denied/,
    );
    await client.exec("RESET ROLE");
    await client.query("INSERT INTO public.app_admins (user_id) VALUES ($1)", [
      userId,
    ]);
    await client.query(
      "SELECT set_config('request.jwt.claim.sub', $1, false)",
      [userId],
    );
    await client.exec("SET ROLE authenticated");
    await client.query(
      "INSERT INTO storage.objects (id, bucket_id) VALUES ($1, 'trip-images')",
      [randomUUID()],
    );
    await assert.rejects(
      client.query(
        "INSERT INTO storage.objects (id, bucket_id) VALUES ($1, 'private-other')",
        [randomUUID()],
      ),
      /row-level security/,
    );
    await client.exec("RESET ROLE");
    await client.query(
      "SELECT set_config('request.jwt.claim.sub', $1, false)",
      [randomUUID()],
    );
    await client.exec("SET ROLE authenticated");
    await assert.rejects(
      client.query(
        "INSERT INTO storage.objects (id, bucket_id) VALUES ($1, 'trip-images')",
        [randomUUID()],
      ),
      /row-level security/,
    );
    await assert.rejects(
      client.query("SELECT * FROM stg_private.receipts"),
      /permission denied/,
    );
    await client.exec("RESET ROLE");
    const firstInput = input();
    const first = await issueReceipt(serviceDb, firstInput, userId);
    assert.equal(first.receipt.number, 1);
    assert.equal(first.receipt.totalArs, "15400.00");
    assert.equal(first.replayed, false);
    const replay = await issueReceipt(serviceDb, firstInput, userId);
    assert.equal(replay.receipt.id, first.receipt.id);
    assert.equal(replay.replayed, true);
    await assert.rejects(
      issueReceipt(
        serviceDb,
        { ...firstInput, client: "Otro cliente" },
        userId,
      ),
      /otros datos/,
    );
    const [document] = await db
      .select()
      .from(receiptDocuments)
      .where(eq(receiptDocuments.receiptId, first.receipt.id));
    const pdf = await PDFDocument.load(document.content);
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(pdf.getPage(0).getWidth(), 595);
    assert.equal(pdf.getPage(0).getHeight(), 842);
    const outputDir = process.env.STG_TEST_OUTPUT_DIR;
    if (outputDir) {
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        path.join(outputDir, "recibo-ejemplo.pdf"),
        document.content,
      );
    }
    // Unsupported input forces a PDF error after INSERT. The entire issue, document and counter roll back.
    await assert.rejects(
      issueReceipt(serviceDb, input({ client: "Cliente 🚀" }), userId),
    );
    assert.equal((await db.select().from(receipts)).length, 1);
    assert.equal((await db.select().from(receiptDocuments)).length, 1);
    assert.equal((await db.select().from(receiptCounter))[0].nextNumber, 2);
    const second = await issueReceipt(
      serviceDb,
      input({
        currency: "ARS",
        amount: "570000",
        exchangeRate: "3",
        client: "Cliente de prueba ARS",
      }),
      userId,
    );
    assert.equal(second.receipt.number, 2);
    assert.equal(second.receipt.totalArs, "570000.00");
    if (outputDir) {
      const [documentArs] = await db
        .select()
        .from(receiptDocuments)
        .where(eq(receiptDocuments.receiptId, second.receipt.id));
      await writeFile(
        path.join(outputDir, "recibo-ars-ejemplo.pdf"),
        documentArs.content,
      );
    }
    const repeated = input();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        issueReceipt(serviceDb, repeated, userId),
      ),
    );
    assert.equal(new Set(results.map((row) => row.receipt.id)).size, 1);
    assert.equal((await db.select().from(receiptCounter))[0].nextNumber, 4);
    assert.equal((await db.select().from(receipts)).length, 3);
    const originals = await db
      .select()
      .from(receiptDocuments)
      .where(eq(receiptDocuments.receiptId, first.receipt.id));
    assert.equal(originals[0].sha256, document.sha256);
  } finally {
    await client.close();
  }
});
