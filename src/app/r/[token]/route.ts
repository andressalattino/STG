import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { receiptDocuments, receiptShares, receipts } from "@/db/schema";
import { apiError, HttpError } from "@/server/http";
import { pdfResponse } from "@/server/receipts/response";
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new HttpError(404, "El enlace no existe o venció.");
    const hash = createHash("sha256").update(token).digest("hex");
    const [row] = await getDb()
      .select({
        content: receiptDocuments.content,
        number: receipts.number,
        client: receipts.client,
      })
      .from(receiptShares)
      .innerJoin(receipts, eq(receipts.id, receiptShares.receiptId))
      .innerJoin(receiptDocuments, eq(receiptDocuments.receiptId, receipts.id))
      .where(
        and(
          eq(receiptShares.tokenHash, hash),
          gt(receiptShares.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row)
      throw new HttpError(
        404,
        "El enlace no existe o venció. Solicitá uno nuevo a STG.",
      );
    return pdfResponse(row.content, row);
  } catch (error) {
    return apiError(error);
  }
}
