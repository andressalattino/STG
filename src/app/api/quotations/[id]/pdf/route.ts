import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { quotationDocuments, quotations } from "@/db/schema";
import { quotationFilename } from "@/features/quotations/domain";
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
        content: quotationDocuments.content,
        number: quotations.number,
        data: quotations.data,
      })
      .from(quotationDocuments)
      .innerJoin(quotations, eq(quotations.id, quotationDocuments.quotationId))
      .where(eq(quotations.id, id))
      .limit(1);
    if (!row) throw new HttpError(404, "No se encontró la cotización.");
    return new Response(new Uint8Array(row.content), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${quotationFilename(row)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
