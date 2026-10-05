import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { expenses, receipts } from "@/db/schema";
import {
  type ExpenseInput,
  type ExpenseRecord,
  fillStatistics,
  type StatisticsInput,
} from "@/features/finance/domain";
import { calculateTotal } from "@/features/receipts/domain";
import { HttpError } from "@/server/http";

export function publicExpense(
  row: typeof expenses.$inferSelect,
): ExpenseRecord {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    paidOn: row.paidOn,
    payee: row.payee,
    concept: row.concept,
    category: row.category as ExpenseRecord["category"],
    currency: row.currency,
    amount: row.amount,
    exchangeRate: row.exchangeRate,
    totalArs: row.totalArs,
    paymentMethod: row.paymentMethod as ExpenseRecord["paymentMethod"],
    reference: row.reference,
    notes: row.notes,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
  };
}
export async function recordExpense(
  db: ReturnType<typeof getDb>,
  input: ExpenseInput,
  userId: string,
) {
  const { requestId, ...values } = input;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  const [created] = await db
    .insert(expenses)
    .values({
      ...values,
      requestId,
      fingerprint,
      createdBy: userId,
      totalArs: calculateTotal(input.amount, input.exchangeRate),
    })
    .onConflictDoNothing({ target: expenses.requestId })
    .returning();
  if (created) return { expense: publicExpense(created), replayed: false };
  const [existing] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.requestId, requestId));
  if (!existing || existing.fingerprint !== fingerprint)
    throw new HttpError(
      409,
      "Este envío ya se usó con otros datos. Iniciá un nuevo egreso.",
    );
  return { expense: publicExpense(existing), replayed: true };
}
export async function voidExpense(
  db: ReturnType<typeof getDb>,
  id: string,
  reason: string,
  userId: string,
) {
  const [updated] = await db
    .update(expenses)
    .set({ voidedAt: new Date(), voidedBy: userId, voidReason: reason })
    .where(and(eq(expenses.id, id), isNull(expenses.voidedAt)))
    .returning();
  if (updated) return publicExpense(updated);
  const [existing] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id));
  if (!existing) throw new HttpError(404, "No se encontró el egreso.");
  return publicExpense(existing);
}
export async function getStatistics(
  db: ReturnType<typeof getDb>,
  input: StatisticsInput,
) {
  const empty = fillStatistics(input, []);
  const grain = empty.group;
  // Range predicates use the indexed source columns. The UNION avoids multiplying receipts by expenses.
  const rows = await db
    .select({
      date: sql<string>`bucket::text`,
      income: sql<string>`sum(income)::text`,
      expenses: sql<string>`sum(outgoing)::text`,
    })
    .from(sql`(
  select date_trunc(${grain}, ${receipts.createdAt} at time zone 'America/Argentina/Buenos_Aires')::date as bucket,
    sum(${receipts.totalArs}) as income, 0::numeric as outgoing
  from ${receipts}
  where ${receipts.createdAt} >= (${input.from}::date::timestamp at time zone 'America/Argentina/Buenos_Aires')
    and ${receipts.createdAt} < ((${input.to}::date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
  group by 1
  union all
  select date_trunc(${grain}, ${expenses.paidOn}::timestamp)::date as bucket,0::numeric as income,sum(${expenses.totalArs}) as outgoing
  from ${expenses} where ${expenses.paidOn} >= ${input.from}::date and ${expenses.paidOn} <= ${input.to}::date and ${expenses.voidedAt} is null
  group by 1
 ) movements`)
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);
  return fillStatistics(input, rows);
}
