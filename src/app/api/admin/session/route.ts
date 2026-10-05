import { requireAdmin } from "@/server/auth";
import { apiError, json } from "@/server/http";
export async function GET(request: Request) {
  try {
    return json(await requireAdmin(request));
  } catch (error) {
    return apiError(error);
  }
}
