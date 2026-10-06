import { count, desc, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { quotations } from "@/db/schema";
import { quotationInputSchema } from "@/features/quotations/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, json, readJson } from "@/server/http";
import { issueQuotation, publicQuotation } from "@/server/quotations/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const input = quotationInputSchema.parse(await readJson(request));
    const result = await issueQuotation(getDb(), input, user.id);
    return json(result, result.replayed ? 200 : 201);
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const input = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        q: z.string().max(100).default(""),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const term = `%${input.q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = input.q
      ? or(
          ilike(quotations.passenger, term),
          ilike(quotations.destination, term),
          sql`cast(${quotations.number} as text) = ${input.q.replace(/^0+/, "")}`,
        )
      : undefined;
    const db = getDb();
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(quotations)
        .where(where)
        .orderBy(desc(quotations.number))
        .limit(20)
        .offset((input.page - 1) * 20),
      db.select({ value: count() }).from(quotations).where(where),
    ]);
    return json({
      quotations: rows.map(publicQuotation),
      total: total.value,
      page: input.page,
      pageSize: 20,
    });
  } catch (e) {
    return apiError(e);
  }
}
