import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { receipts } from "../src/db/schema";
import {
  argentinaToday,
  expenseInputSchema,
  fillStatistics,
  presetRange,
  statisticsSchema,
} from "../src/features/finance/domain";
import {
  getStatistics,
  recordExpense,
  voidExpense,
} from "../src/server/finance/service";

const expense = (overrides: Record<string, unknown> = {}) =>
  expenseInputSchema.parse({
    requestId: randomUUID(),
    paidOn: "2026-10-01",
    payee: "Proveedor de prueba",
    concept: "Pago de alojamiento",
    category: "Alojamiento",
    currency: "ARS",
    amount: "10.50",
    exchangeRate: "1",
    paymentMethod: "Transferencia",
    ...overrides,
  });
test("expense validation, calendar presets and exact signed totals", () => {
  assert.equal(
    expense({ currency: "ARS", exchangeRate: "1550" }).exchangeRate,
    "1.000000",
  );
  assert.equal(expense({ amount: "0,01" }).amount, "0.01");
  for (const invalid of [
    { amount: "0" },
    { amount: "-1" },
    { amount: "1.234,50" },
    { paidOn: "2026-02-30" },
    { payee: " " },
    { currency: "EUR" },
    { exchangeRate: "0" },
  ])
    assert.throws(() => expense(invalid));
  assert.equal(argentinaToday(new Date("2026-10-02T02:59:59Z")), "2026-10-01");
  assert.deepEqual(presetRange("week", "2026-10-04"), {
    from: "2026-09-28",
    to: "2026-10-04",
  });
  assert.deepEqual(presetRange("month", "2024-02-29"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(presetRange("year", "2026-10-02"), {
    from: "2026-01-01",
    to: "2026-10-02",
  });
  assert.throws(() =>
    statisticsSchema.parse({ from: "2026-10-03", to: "2026-10-01" }),
  );
  assert.throws(() =>
    statisticsSchema.parse({ from: "2000-01-01", to: "2026-10-01" }),
  );
  const filled = fillStatistics(
    { from: "2026-10-01", to: "2026-10-03", group: "day" },
    [{ date: "2026-10-01", income: "100.01", expenses: "100.02" }],
  );
  assert.equal(filled.balance, "-0.01");
  assert.equal(filled.points.length, 3);
  assert.equal(filled.points[2].balance, "0.00");
  const large = fillStatistics(
    { from: "2026-10-01", to: "2026-10-01", group: "day" },
    [{ date: "2026-10-01", income: "9999999999999999.99", expenses: "0.01" }],
  );
  assert.equal(large.balance, "9999999999999999.98");
  const aggregate = fillStatistics(
    { from: "2026-10-01", to: "2026-10-02", group: "day" },
    [
      { date: "2026-10-01", income: "999999999999999999.99", expenses: "0.00" },
      { date: "2026-10-02", income: "0.02", expenses: "0.00" },
    ],
  );
  assert.equal(aggregate.balance, "1000000000000000000.01");
});
test("PostgreSQL expenses are idempotent, private, voidable and aggregated in Argentina time", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  const serviceDb = db as unknown as Parameters<typeof recordExpense>[0];
  const user = randomUUID();
  try {
    await client.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    for (const entry of journal.entries.filter(
      (entry) => entry.tag !== "0002_supabase_storage",
    )) {
      for (const statement of (
        await readFile(`drizzle/${entry.tag}.sql`, "utf8")
      ).split("--> statement-breakpoint"))
        if (statement.trim()) await client.exec(statement);
    }
    const ars = expense();
    const first = await recordExpense(serviceDb, ars, user);
    const retry = await recordExpense(serviceDb, ars, user);
    assert.equal(retry.expense.id, first.expense.id);
    assert.equal(retry.replayed, true);
    await assert.rejects(
      recordExpense(serviceDb, { ...ars, amount: "20.00" }, user),
      /otros datos/,
    );
    const usd = await recordExpense(
      serviceDb,
      expense({ currency: "USD", amount: "10", exchangeRate: "1540" }),
      user,
    );
    assert.equal(usd.expense.totalArs, "15400.00");
    const voided = await recordExpense(
      serviceDb,
      expense({ amount: "999" }),
      user,
    );
    await voidExpense(serviceDb, voided.expense.id, "Carga equivocada", user);
    await voidExpense(serviceDb, voided.expense.id, "Segundo intento", user);
    const canceled = await client.query<{ void_reason: string }>(
      "select void_reason from stg_private.expenses where id=$1",
      [voided.expense.id],
    );
    assert.equal(canceled.rows[0].void_reason, "Carga equivocada");
    await recordExpense(
      serviceDb,
      expense({ paidOn: "2026-09-30", amount: "888" }),
      user,
    );
    await recordExpense(
      serviceDb,
      expense({ paidOn: "2026-10-03", amount: "777" }),
      user,
    );
    for (const [index, [createdAt, total]] of [
      ["2026-10-01T02:59:59.999Z", "500.00"],
      ["2026-10-01T03:00:00.000Z", "100.01"],
      ["2026-10-03T02:59:59.999Z", "200.02"],
      ["2026-10-03T03:00:00.000Z", "600.00"],
    ].entries())
      await db.insert(receipts).values({
        number: index + 1,
        requestId: randomUUID(),
        fingerprint: "test",
        createdBy: user,
        createdAt: new Date(createdAt),
        client: "Prueba",
        currency: "ARS",
        amount: total,
        exchangeRate: "1",
        totalArs: total,
        reservation: "R",
        passengers: 1,
        travelDate: "2027-01-01",
        destination: "Prueba",
        paymentMethod: "Transferencia",
        rateSource: "ars",
      });
    const stats = await getStatistics(serviceDb, {
      from: "2026-10-01",
      to: "2026-10-02",
      group: "day",
    });
    assert.equal(stats.income, "300.03");
    assert.equal(stats.expenses, "15410.50");
    assert.equal(stats.balance, "-15110.47");
    assert.equal(stats.points.length, 2);
    assert.equal(stats.points[1].income, "200.02");
    const weekly = await getStatistics(serviceDb, {
      from: "2026-10-01",
      to: "2026-10-02",
      group: "week",
    });
    assert.equal(weekly.points.length, 1);
    assert.equal(weekly.points[0].date, "2026-09-28");
    assert.equal(weekly.balance, stats.balance);
    const monthly = await getStatistics(serviceDb, {
      from: "2026-10-01",
      to: "2026-10-02",
      group: "month",
    });
    assert.equal(monthly.income, stats.income);
    const empty = await getStatistics(serviceDb, {
      from: "2025-02-01",
      to: "2025-02-28",
      group: "auto",
    });
    assert.equal(empty.income, "0.00");
    assert.equal(empty.expenses, "0.00");
    assert.equal(empty.points.length, 28);
    await assert.rejects(
      client.query(
        "update stg_private.expenses set voided_at=now(),voided_by=$1,void_reason=null where id=$2",
        [user, first.expense.id],
      ),
      /expense_void_rules/,
    );
    for (const role of ["anon", "authenticated"]) {
      await client.exec(`SET ROLE ${role}`);
      await assert.rejects(
        client.query("select * from stg_private.expenses"),
        /permission denied/,
      );
      await client.exec("RESET ROLE");
    }
  } finally {
    await client.close();
  }
});
