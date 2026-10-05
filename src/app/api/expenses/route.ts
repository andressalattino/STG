import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { expenses } from "@/db/schema";
import { dateSchema, expenseInputSchema } from "@/features/finance/domain";
import { requireAdmin } from "@/server/auth";
import { publicExpense, recordExpense } from "@/server/finance/service";
import { apiError, json, readJson } from "@/server/http";

const filters = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    q: z.string().max(120).default(""),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    status: z.enum(["active", "voided", "all"]).default("active"),
    currency: z.enum(["ARS", "USD"]).optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Revisá el orden de las fechas.",
  );
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const input = filters.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const q = `%${input.q.replace(/[\\%_]/g, "\\$&")}%`;
    const condition = and(
      input.from ? gte(expenses.paidOn, input.from) : undefined,
      input.to ? lte(expenses.paidOn, input.to) : undefined,
      input.q
        ? or(
            ilike(expenses.payee, q),
            ilike(expenses.concept, q),
            ilike(expenses.reference, q),
          )
        : undefined,
      input.currency ? eq(expenses.currency, input.currency) : undefined,
      input.status === "active"
        ? isNull(expenses.voidedAt)
        : input.status === "voided"
          ? isNotNull(expenses.voidedAt)
          : undefined,
    );
    const db = getDb();
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(expenses)
        .where(condition)
        .orderBy(
          desc(expenses.paidOn),
          desc(expenses.createdAt),
          desc(expenses.id),
        )
        .limit(20)
        .offset((input.page - 1) * 20),
      db.select({ value: count() }).from(expenses).where(condition),
    ]);
    return json({
      expenses: rows.map(publicExpense),
      total: total.value,
      page: input.page,
      pageSize: 20,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const input = expenseInputSchema.parse(await readJson(request));
    const result = await recordExpense(getDb(), input, user.id);
    return json(result, result.replayed ? 200 : 201);
  } catch (error) {
    return apiError(error);
  }
}
