import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/server/auth";
import { apiError, json, readJson } from "@/server/http";
import { initializeNumbering } from "@/server/receipts/service";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { start } = z
      .object({ start: z.number().int().min(1).max(999999) })
      .parse(await readJson(request));
    await initializeNumbering(getDb(), start);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
