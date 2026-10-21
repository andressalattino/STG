import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contractDocuments, contracts } from "@/db/schema";
import { contractFilename } from "@/features/contracts/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError } from "@/server/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const id = z.uuid().parse((await context.params).id);
    const [row] = await getDb()
      .select({
        content: contractDocuments.content,
        number: contracts.number,
        version: contracts.version,
      })
      .from(contractDocuments)
      .innerJoin(contracts, eq(contracts.id, contractDocuments.contractId))
      .where(eq(contracts.id, id))
      .limit(1);
    if (!row) throw new HttpError(404, "No se encontró el contrato.");
    return new Response(new Uint8Array(row.content), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${contractFilename(row)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
