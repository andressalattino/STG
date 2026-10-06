import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PDFDocument } from "pdf-lib";
import {
  quotationDraftSchema,
  quotationInputSchema,
  returnLegs,
  tripNights,
} from "../src/features/quotations/domain";
import { getStatistics } from "../src/server/finance/service";
import { renderQuotationPdf } from "../src/server/quotations/pdf";
import { issueQuotation } from "../src/server/quotations/service";
import { exampleQuotation } from "./quotation-fixture";

test("quotations validate conditional fields, dates, money and inverse round trips", () => {
  const data = exampleQuotation();
  assert.deepEqual(returnLegs(data.legs), [
    { mode: "Bus", from: "Hotel", to: "Aeropuerto" },
    { mode: "Aéreo", from: "Río de Janeiro", to: "Buenos Aires" },
    { mode: "Aéreo", from: "Buenos Aires", to: "Mendoza" },
  ]);
  assert.deepEqual(returnLegs(returnLegs(data.legs)), data.legs);
  assert.equal(tripNights("2028-02-28", "2028-03-01"), 2);
  assert.equal(
    quotationDraftSchema.parse({
      ...data,
      currency: "ARS",
      exchangeRate: "999",
      amount: "1,25",
    }).exchangeRate,
    "1.000000",
  );
  for (const bad of [
    { endDate: "2027-01-14" },
    { startDate: "2027-02-30" },
    { amount: "1.000,20" },
    { passengers: 0 },
    { transport: "Clásico" },
    { hotels: [] },
    { nights: 0 },
    { assistanceName: "" },
    { excursionDetails: "" },
  ])
    assert.throws(() => quotationDraftSchema.parse({ ...data, ...bad }));
  const basic = quotationDraftSchema.parse({
    ...data,
    lodging: false,
    assistance: false,
    excursions: false,
    transfers: false,
  });
  assert.deepEqual(basic.hotels, []);
  assert.equal(basic.nights, 0);
  assert.equal(basic.excursionDetails, "");
});
test("quotation PDF uses A4 and paginates long notes", async () => {
  const data = exampleQuotation();
  const record = {
    id: "sample",
    number: 184,
    createdAt: "2026-10-06T15:00:00Z",
    expiresAt: "2026-10-09T15:00:00Z",
    data,
  };
  const pdf = await PDFDocument.load(await renderQuotationPdf(record));
  assert.equal(
    pdf.getPageCount(),
    1,
    "El modelo normal debe entrar en una hoja A4",
  );
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.28) < 0.01);
  const long = await PDFDocument.load(
    await renderQuotationPdf({
      ...record,
      data: { ...data, notes: "Nota extensa. ".repeat(150), roundTrip: true },
    }),
  );
  assert.ok(long.getPageCount() > 1);
  for (const page of long.getPages())
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.01);
});
test("quotations have independent transactional numbering, immutable PDF, idempotency and private storage", async () => {
  const client = new PGlite();
  const db = drizzle(client) as unknown as Parameters<typeof issueQuotation>[0];
  try {
    await client.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    for (const { tag } of journal.entries.filter(
      (e) => e.tag !== "0002_supabase_storage",
    )) {
      for (const statement of (
        await readFile(`drizzle/${tag}.sql`, "utf8")
      ).split("--> statement-breakpoint"))
        if (statement.trim()) await client.exec(statement);
    }
    const user = randomUUID(),
      data = exampleQuotation();
    const input = quotationInputSchema.parse({ requestId: randomUUID(), data });
    const first = await issueQuotation(db, input, user);
    assert.equal(first.quotation.number, 1);
    assert.equal(
      new Date(first.quotation.expiresAt).getTime() -
        new Date(first.quotation.createdAt).getTime(),
      72 * 3600000,
    );
    const retry = await issueQuotation(db, input, user);
    assert.equal(retry.quotation.id, first.quotation.id);
    assert.equal(retry.replayed, true);
    await assert.rejects(
      issueQuotation(
        db,
        { ...input, data: { ...data, amount: "3000.00" } },
        user,
      ),
      /otros datos/,
    );
    // A PDF encoding failure must roll back both the insert and the counter.
    await assert.rejects(
      issueQuotation(
        db,
        { requestId: randomUUID(), data: { ...data, passenger: "Emoji 🧳" } },
        user,
      ),
    );
    const second = await issueQuotation(
      db,
      { requestId: randomUUID(), data },
      user,
    );
    assert.equal(second.quotation.number, 2);
    const docs = await client.query<{ sha256: string; content: Uint8Array }>(
      "SELECT sha256, content FROM stg_private.quotation_documents",
    );
    assert.equal(docs.rows.length, 2);
    for (const d of docs.rows)
      assert.equal(
        createHash("sha256").update(d.content).digest("hex"),
        d.sha256,
      );
    const stats = await getStatistics(db, {
      from: "2026-01-01",
      to: "2026-12-31",
      group: "month",
    });
    assert.equal(stats.income, "0.00");
    assert.equal(
      (
        await client.query<{ n: number }>(
          "SELECT count(*)::int as n FROM stg_private.receipts",
        )
      ).rows[0].n,
      0,
    );
    for (const role of ["anon", "authenticated"]) {
      await client.exec(`SET ROLE ${role}`);
      await assert.rejects(
        client.query("SELECT * FROM stg_private.quotations"),
      );
      await assert.rejects(
        client.query("SELECT * FROM stg_private.quotation_documents"),
      );
      await client.exec("RESET ROLE");
    }
  } finally {
    await client.close();
  }
});
