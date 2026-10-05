import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { receiptDocuments, receipts } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError } from "@/server/http";
import { pdfResponse } from "@/server/receipts/response";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const id = z.uuid().parse((await context.params).id);
    const [row] = await getDb()
      .select({
        content: receiptDocuments.content,
        number: receipts.number,
        client: receipts.client,
      })
      .from(receiptDocuments)
      .innerJoin(receipts, eq(receipts.id, receiptDocuments.receiptId))
      .where(eq(receipts.id, id))
      .limit(1);
    if (!row) throw new HttpError(404, "No se encontró el PDF.");
    return pdfResponse(
      row.content,
      row,
      new URL(request.url).searchParams.has("download"),
    );
  } catch (error) {
    return apiError(error);
  }
}
