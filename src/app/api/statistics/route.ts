import { getDb } from "@/db";
import { statisticsSchema } from "@/features/finance/domain";
import { requireAdmin } from "@/server/auth";
import { getStatistics } from "@/server/finance/service";
import { apiError, json } from "@/server/http";
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const input = statisticsSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return json(await getStatistics(getDb(), input));
  } catch (error) {
    return apiError(error);
  }
}
