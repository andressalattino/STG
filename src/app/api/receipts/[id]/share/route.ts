import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { receiptShares, receipts } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError, json } from "@/server/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin(request);
    const id = z.uuid().parse((await context.params).id);
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin?.startsWith("https://"))
      throw new HttpError(
        409,
        "Para compartir enlaces necesitás publicar la web y configurar NEXT_PUBLIC_SITE_URL con HTTPS. Ahora podés descargar el PDF y adjuntarlo.",
      );
    const baseUrl = new URL(origin);
    if (
      baseUrl.hostname === "localhost" ||
      baseUrl.username ||
      baseUrl.password
    )
      throw new HttpError(409, "Configurá la dirección pública de la web.");
    const db = getDb();
    const [receipt] = await db
      .select({ id: receipts.id })
      .from(receipts)
      .where(eq(receipts.id, id))
      .limit(1);
    if (!receipt) throw new HttpError(404, "No se encontró el recibo.");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await db.insert(receiptShares).values({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      receiptId: id,
      expiresAt,
      createdBy: user.id,
    });
    return json({
      url: new URL(`/r/${token}`, baseUrl.origin).href,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
