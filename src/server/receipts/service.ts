import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { receiptCounter, receiptDocuments, receipts } from "@/db/schema";
import {
  calculateTotal,
  type ReceiptInput,
  type ReceiptRecord,
} from "@/features/receipts/domain";
import { HttpError } from "@/server/http";
import { renderReceiptPdf } from "./pdf";

export function publicReceipt(
  row: typeof receipts.$inferSelect,
): ReceiptRecord {
  return {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt.toISOString(),
    client: row.client,
    currency: row.currency,
    amount: row.amount,
    exchangeRate: row.exchangeRate,
    totalArs: row.totalArs,
    reservation: row.reservation,
    passengers: row.passengers,
    travelDate: row.travelDate,
    destination: row.destination,
    paymentMethod: row.paymentMethod as ReceiptRecord["paymentMethod"],
    rateSource: row.rateSource as ReceiptRecord["rateSource"],
    quoteUpdatedAt: row.quoteUpdatedAt?.toISOString() ?? null,
    templateVersion: row.templateVersion,
  };
}
export async function issueReceipt(
  db: ReturnType<typeof getDb>,
  input: ReceiptInput,
  userId: string,
) {
  const { requestId, ...values } = input;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  return db.transaction(async (tx) => {
    // One row lock covers numbering and idempotency across all server instances.
    const [counter] = await tx
      .select()
      .from(receiptCounter)
      .where(eq(receiptCounter.id, 1))
      .for("update");
    const [existing] = await tx
      .select()
      .from(receipts)
      .where(eq(receipts.requestId, requestId))
      .limit(1);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new HttpError(
          409,
          "Este envío ya se utilizó con otros datos. Iniciá un nuevo recibo.",
        );
      return { receipt: publicReceipt(existing), replayed: true };
    }
    if (!counter?.initialized)
      throw new HttpError(
        409,
        "Configurá el primer número de recibo antes de emitir.",
      );
    if (counter.nextNumber > 999999)
      throw new HttpError(
        409,
        "Se alcanzó el límite de seis dígitos. Contactá al administrador.",
      );
    const [row] = await tx
      .insert(receipts)
      .values({
        ...values,
        requestId,
        fingerprint,
        number: counter.nextNumber,
        createdBy: userId,
        totalArs: calculateTotal(input.amount, input.exchangeRate),
        quoteUpdatedAt: input.quoteUpdatedAt
          ? new Date(input.quoteUpdatedAt)
          : null,
      })
      .returning();
    const receipt = publicReceipt(row);
    const content = Buffer.from(await renderReceiptPdf(receipt));
    await tx.insert(receiptDocuments).values({
      receiptId: row.id,
      content,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    await tx
      .update(receiptCounter)
      .set({ nextNumber: sql`${receiptCounter.nextNumber} + 1` })
      .where(eq(receiptCounter.id, 1));
    return { receipt, replayed: false };
  });
}
export async function initializeNumbering(
  db: ReturnType<typeof getDb>,
  start: number,
) {
  return db.transaction(async (tx) => {
    const [counter] = await tx
      .select()
      .from(receiptCounter)
      .where(eq(receiptCounter.id, 1))
      .for("update");
    if (!counter)
      throw new HttpError(503, "Ejecutá las migraciones de recibos.");
    if (counter.initialized)
      throw new HttpError(
        409,
        "La numeración ya está configurada y no puede reiniciarse.",
      );
    await tx
      .update(receiptCounter)
      .set({ nextNumber: start, initialized: true })
      .where(eq(receiptCounter.id, 1));
  });
}
