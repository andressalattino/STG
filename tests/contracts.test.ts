import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PDFDocument } from "pdf-lib";
import {
  contractDraftSchema,
  contractFilename,
  contractInputSchema,
  contractTotals,
  normalizeContractData,
} from "../src/features/contracts/domain";
import { renderContractPdf } from "../src/server/contracts/pdf";
import { issueContract, listContracts } from "../src/server/contracts/service";
import { getStatistics } from "../src/server/finance/service";
import { exampleContract, maximumContract } from "./contract-fixture";

test("contracts calculate per-person/group amounts exactly and validate passengers, lodging, dates and deposits", () => {
  const data = exampleContract();
  const { reservationNumber: _reservation, ...previousFormat } = data;
  assert.equal(contractDraftSchema.parse(previousFormat).reservationNumber, "");
  assert.deepEqual(contractTotals(data), {
    total: "299801.00",
    remaining: "249801.00",
    totalArs: "299801.00",
  });
  const usd = contractDraftSchema.parse({
    ...data,
    currency: "USD",
    exchangeRate: "1500,125",
    unitPrice: "100,25",
    deposit: "0",
    rateSource: "manual",
  });
  assert.deepEqual(contractTotals(usd), {
    total: "200.50",
    remaining: "200.50",
    totalArs: "300775.06",
  });
  assert.equal(
    contractDraftSchema.parse({ ...data, exchangeRate: "333" }).exchangeRate,
    "1.000000",
  );
  for (const bad of [
    { unitPrice: "1.000,00" },
    { unitPrice: "0" },
    { deposit: "299801.01" },
    { exchangeRate: "0" },
    { passengers: [] },
    {
      passengers: [
        data.passengers[0],
        { ...data.passengers[1], dni: data.passengers[0].dni },
      ],
    },
    { passengers: [{ ...data.passengers[0], birthDate: "2028-02-30" }] },
    { passengers: [{ ...data.passengers[0], birthDate: "2090-01-01" }] },
    { return: { ...data.return, date: "2027-01-14" } },
    { hotels: [{ ...data.hotels[0], rooms: [] }] },
    { hotels: [{ ...data.hotels[0], checkOut: "2027-01-16" }] },
    { hotels: [{ ...data.hotels[0], checkIn: "2027-01-10" }] },
    { hotels: [{ ...data.hotels[0], meals: ["All inclusive", "Cena"] }] },
  ])
    assert.throws(() => contractDraftSchema.parse({ ...data, ...bad }));
  assert.deepEqual(
    contractDraftSchema.parse({
      ...data,
      hotels: [],
      transport: [],
      excursions: [],
    }).hotels,
    [],
  );
  assert.equal(
    contractFilename({ number: 1, version: 2 }),
    "Contrato_000001_v2.pdf",
  );
});

test("contract PDFs always use one A4 sheet, fit six passengers/three hotels, and reject overflow", async () => {
  const data = exampleContract();
  const record = {
    id: "preview",
    number: 1,
    version: 1,
    previousId: null,
    createdAt: "2026-10-20T15:00:00Z",
    data,
  };
  const normal = await PDFDocument.load(await renderContractPdf(record));
  const extended = await PDFDocument.load(
    await renderContractPdf({
      ...record,
      data: maximumContract(),
    }),
  );
  assert.equal(
    normal.getPageCount(),
    1,
    "El contrato habitual debe entrar en una hoja A4 con firmas.",
  );
  assert.equal(extended.getPageCount(), 1);
  const withoutHotels = await PDFDocument.load(
    await renderContractPdf({
      ...record,
      data: { ...data, hotels: [], passengers: data.passengers.slice(0, 1) },
    }),
  );
  assert.equal(withoutHotels.getPageCount(), 1);
  await assert.rejects(
    renderContractPdf({
      ...record,
      data: {
        ...data,
        notes: "Observación.\n".repeat(180),
      },
    }),
    /CONTRACT_SINGLE_PAGE_OVERFLOW/,
  );
  for (const doc of [normal, extended, withoutHotels])
    for (const page of doc.getPages()) {
      assert.ok(Math.abs(page.getWidth() - 595.28) < 0.01);
      assert.ok(Math.abs(page.getHeight() - 841.89) < 0.01);
    }
});

test("contracts support manual totals, new meal/room/transport options and strict client/hotel limits", () => {
  const data = exampleContract();
  const custom = contractDraftSchema.parse({
    ...data,
    totalOverride: "250000",
    deposit: "50000",
  });
  assert.deepEqual(contractTotals(custom), {
    total: "250000.00",
    remaining: "200000.00",
    totalArs: "250000.00",
  });
  assert.equal(
    contractTotals({ ...custom, totalOverride: null }).total,
    "299801.00",
  );
  for (const bad of [
    { totalOverride: "0" },
    { totalOverride: "40000" },
    {
      passengers: Array.from({ length: 7 }, (_, i) => ({
        ...data.passengers[0],
        id: randomUUID(),
        dni: String(30000000 + i),
      })),
    },
    {
      hotels: Array.from({ length: 4 }, () => ({
        ...data.hotels[0],
        id: randomUUID(),
      })),
    },
    {
      transport: [
        { id: randomUUID(), type: "Bus", seat: null, description: "" },
      ],
    },
    {
      transport: [
        { id: randomUUID(), type: "Aéreo", seat: null, description: "" },
      ],
    },
    { hotels: [{ ...data.hotels[0], meals: ["Almuerzo"] }] },
  ])
    assert.throws(() => contractDraftSchema.parse({ ...data, ...bad }));
  for (const seat of ["Cama", "Semicama"])
    assert.equal(
      contractDraftSchema.parse({
        ...data,
        transport: [
          {
            id: randomUUID(),
            type: "Bus",
            seat,
            description: "Empresa de bus",
          },
        ],
      }).transport[0].seat,
      seat,
    );
  for (const type of [
    "Single",
    "Doble matrimonial",
    "Doble individual",
    "Triple matrimonial",
    "Triple individual",
    "Cuádruple",
  ])
    assert.equal(
      contractDraftSchema.parse({
        ...data,
        hotels: [
          {
            ...data.hotels[0],
            rooms: [{ id: randomUUID(), type, quantity: 1 }],
          },
        ],
      }).hotels[0].rooms[0].type,
      type,
    );
  const legacy = {
    ...data,
    transport: undefined,
    totalOverride: undefined,
    flights: [{ id: randomUUID(), description: "Vuelo anterior" }],
    hotels: [
      {
        ...data.hotels[0],
        meals: ["Desayuno", "Cena"],
        rooms: [{ id: randomUUID(), type: "Individual", quantity: 1 }],
      },
    ],
  };
  const upgraded = normalizeContractData(legacy as unknown as typeof data);
  assert.equal(upgraded.transport[0].type, "Aéreo");
  assert.equal(upgraded.hotels[0].meals[0], "Media pensión");
  assert.equal(upgraded.hotels[0].rooms[0].type, "Single");
  assert.equal(legacy.hotels[0].rooms[0].type, "Individual");
});

test("contract numbering, immutable revisions, retries, rollback and private access leave finance untouched", async () => {
  const client = new PGlite();
  const db = drizzle(client) as unknown as Parameters<typeof issueContract>[0];
  try {
    await client.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    for (const { tag } of journal.entries.filter(
      (e) => e.tag !== "0002_supabase_storage",
    ))
      for (const statement of (
        await readFile(`drizzle/${tag}.sql`, "utf8")
      ).split("--> statement-breakpoint"))
        if (statement.trim()) await client.exec(statement);
    const data = exampleContract(),
      user = randomUUID();
    const input = contractInputSchema.parse({
      requestId: randomUUID(),
      previousId: null,
      data,
    });
    const first = await issueContract(db, input, user);
    assert.equal(first.contract.data.reservationNumber, data.reservationNumber);
    assert.equal(first.contract.number, 1);
    assert.equal(first.contract.version, 1);
    const original = (
      await client.query<{ sha256: string; content: Uint8Array }>(
        "select sha256, content from stg_private.contract_documents",
      )
    ).rows[0];
    const retry = await issueContract(db, input, user);
    assert.equal(retry.contract.id, first.contract.id);
    assert.equal(retry.replayed, true);
    await assert.rejects(
      issueContract(
        db,
        { ...input, data: { ...data, notes: "Otros datos" } },
        user,
      ),
      /otros datos/,
    );
    const revisionInput = {
      requestId: randomUUID(),
      previousId: first.contract.id,
      data: { ...data, notes: "Nueva observación" },
    };
    const revision = await issueContract(db, revisionInput, user);
    assert.equal(revision.contract.number, 1);
    assert.equal(revision.contract.version, 2);
    assert.equal(revision.contract.previousId, first.contract.id);
    assert.equal(
      (await issueContract(db, revisionInput, user)).contract.id,
      revision.contract.id,
    );
    await assert.rejects(
      issueContract(db, { ...revisionInput, requestId: randomUUID() }, user),
      /más reciente/,
    );
    await assert.rejects(
      issueContract(
        db,
        { ...input, requestId: randomUUID(), previousId: randomUUID() },
        user,
      ),
      /original/,
    );
    await assert.rejects(
      issueContract(
        db,
        {
          ...input,
          requestId: randomUUID(),
          data: { ...data, destination: "Texto 🧳" },
        },
        user,
      ),
    );
    await assert.rejects(
      issueContract(
        db,
        {
          ...input,
          requestId: randomUUID(),
          data: { ...data, notes: "Observación.\n".repeat(180) },
        },
        user,
      ),
      /CONTRACT_SINGLE_PAGE_OVERFLOW/,
    );
    const second = await issueContract(
      db,
      { ...input, requestId: randomUUID() },
      user,
    );
    assert.equal(second.contract.number, 2);
    for (const q of ["000001", "María", "30.123.456", "Bariloche"]) {
      const list = await listContracts(db, { page: 1, q });
      assert.ok(
        list.contracts.some(
          (row) => row.id === revision.contract.id && row.isLatest,
        ),
      );
      assert.equal(
        list.contracts.find((row) => row.id === first.contract.id)?.isLatest,
        false,
      );
    }
    assert.equal(
      (await listContracts(db, { page: 1, q: "%" })).total,
      0,
      "Search metacharacters must be literal",
    );
    assert.equal(
      (await listContracts(db, { page: 2, q: "" })).contracts.length,
      0,
    );
    const docs = await client.query<{
      contract_id: string;
      sha256: string;
      content: Uint8Array;
    }>(
      "select contract_id, sha256, content from stg_private.contract_documents",
    );
    assert.equal(docs.rows.length, 3);
    const savedOriginal = docs.rows.find(
      (r) => r.contract_id === first.contract.id,
    );
    assert.equal(savedOriginal?.sha256, original.sha256);
    assert.deepEqual(savedOriginal?.content, original.content);
    for (const row of docs.rows)
      assert.equal(
        createHash("sha256").update(row.content).digest("hex"),
        row.sha256,
      );
    assert.equal(
      (
        await client.query<{ next_number: number }>(
          "select next_number from stg_private.contract_counter where id=1",
        )
      ).rows[0].next_number,
      3,
    );
    const stats = await getStatistics(db, {
      from: "2026-01-01",
      to: "2026-12-31",
      group: "month",
    });
    assert.equal(stats.income, "0.00");
    assert.equal(stats.expenses, "0.00");
    for (const role of ["anon", "authenticated"]) {
      await client.exec(`SET ROLE ${role}`);
      for (const table of [
        "contracts",
        "contract_documents",
        "contract_counter",
      ])
        await assert.rejects(
          client.query(`select * from stg_private.${table}`),
        );
      await client.exec("RESET ROLE");
    }
  } finally {
    await client.close();
  }
});
