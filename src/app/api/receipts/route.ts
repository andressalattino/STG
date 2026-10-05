import { and, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { receiptCounter, receipts } from "@/db/schema";
import { receiptInputSchema } from "@/features/receipts/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, json, readJson } from "@/server/http";
import { issueReceipt, publicReceipt } from "@/server/receipts/service";
export const runtime = "nodejs";
const filters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().max(100).default(""),
  currency: z.enum(["ARS", "USD"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const input = filters.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const query = `%${input.q.replace(/[\\%_]/g, "\\$&")}%`;
    const condition = and(
      input.q
        ? or(
            ilike(receipts.client, query),
            ilike(receipts.reservation, query),
            ilike(receipts.destination, query),
            sql`cast(${receipts.number} as text) = ${input.q.replace(/^0+/, "")}`,
          )
        : undefined,
      input.currency ? eq(receipts.currency, input.currency) : undefined,
      input.from
        ? gte(receipts.createdAt, new Date(`${input.from}T00:00:00-03:00`))
        : undefined,
      input.to
        ? lt(
            receipts.createdAt,
            new Date(
              new Date(`${input.to}T00:00:00-03:00`).getTime() + 86400000,
            ),
          )
        : undefined,
    );
    const db = getDb();
    const [rows, [total], [counter]] = await Promise.all([
      db
        .select()
        .from(receipts)
        .where(condition)
        .orderBy(desc(receipts.number))
        .limit(20)
        .offset((input.page - 1) * 20),
      db.select({ value: count() }).from(receipts).where(condition),
      db.select().from(receiptCounter).where(eq(receiptCounter.id, 1)),
    ]);
    return json({
      receipts: rows.map(publicReceipt),
      total: total.value,
      page: input.page,
      pageSize: 20,
      numbering: counter ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const input = receiptInputSchema.parse(await readJson(request));
    const result = await issueReceipt(getDb(), input, user.id);
    return json(result, result.replayed ? 200 : 201);
  } catch (error) {
    return apiError(error);
  }
}
