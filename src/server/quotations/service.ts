import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { quotationCounter, quotationDocuments, quotations } from "@/db/schema";
import type {
  QuotationInput,
  QuotationRecord,
} from "@/features/quotations/domain";
import { HttpError } from "@/server/http";
import { renderQuotationPdf } from "./pdf";

export function publicQuotation(
  row: typeof quotations.$inferSelect,
): QuotationRecord {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    data: row.data,
  };
}
export async function issueQuotation(
  db: ReturnType<typeof getDb>,
  input: QuotationInput,
  userId: string,
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input.data))
    .digest("hex");
  return db.transaction(async (tx) => {
    const [counter] = await tx
      .select()
      .from(quotationCounter)
      .where(eq(quotationCounter.id, 1))
      .for("update");
    if (!counter)
      throw new HttpError(503, "Falta aplicar la migración de cotizaciones.");
    const [existing] = await tx
      .select()
      .from(quotations)
      .where(eq(quotations.requestId, input.requestId))
      .limit(1);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new HttpError(409, "Este envío ya se guardó con otros datos.");
      return { quotation: publicQuotation(existing), replayed: true };
    }
    if (counter.nextNumber > 999999)
      throw new HttpError(
        409,
        "Se alcanzó el límite de numeración de cotizaciones.",
      );
    const now = new Date();
    const [row] = await tx
      .insert(quotations)
      .values({
        requestId: input.requestId,
        fingerprint,
        createdBy: userId,
        number: counter.nextNumber,
        passenger: input.data.passenger,
        destination: input.data.destination,
        data: input.data,
        createdAt: now,
        expiresAt: new Date(now.getTime() + input.data.validityHours * 3600000),
      })
      .returning();
    const quotation = publicQuotation(row);
    const content = Buffer.from(await renderQuotationPdf(quotation));
    await tx.insert(quotationDocuments).values({
      quotationId: row.id,
      content,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    await tx
      .update(quotationCounter)
      .set({ nextNumber: sql`${quotationCounter.nextNumber} + 1` })
      .where(eq(quotationCounter.id, 1));
    return { quotation, replayed: false };
  });
}
