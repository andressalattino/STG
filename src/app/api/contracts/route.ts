import { z } from "zod";
import { getDb } from "@/db";
import { contractInputSchema } from "@/features/contracts/domain";
import { requireAdmin } from "@/server/auth";
import { issueContract, listContracts } from "@/server/contracts/service";
import { apiError, json, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const input = contractInputSchema.parse(await readJson(request, 131_072));
    const result = await issueContract(getDb(), input, user.id);
    return json(result, result.replayed ? 200 : 201);
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const input = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        q: z.string().trim().max(120).default(""),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await listContracts(getDb(), input));
  } catch (error) {
    return apiError(error);
  }
}
