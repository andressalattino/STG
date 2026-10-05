import { z } from "zod";
import { getDb } from "@/db";
import { voidExpenseSchema } from "@/features/finance/domain";
import { requireAdmin } from "@/server/auth";
import { voidExpense } from "@/server/finance/service";
import { apiError, json, readJson } from "@/server/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin(request);
    const id = z.uuid().parse((await context.params).id);
    const { reason } = voidExpenseSchema.parse(await readJson(request));
    return json({ expense: await voidExpense(getDb(), id, reason, user.id) });
  } catch (error) {
    return apiError(error);
  }
}
