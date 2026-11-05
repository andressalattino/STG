import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { flyers } from "@/db/schema";
import { flyerSchema } from "@/features/flyers/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError, json, readJson } from "@/server/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    await requireAdmin(request);
    const id = z.uuid().parse((await params).id);
    const data = flyerSchema.parse(await readJson(request));
    const [updated] = await getDb()
      .update(flyers)
      .set({ data, updatedAt: new Date() })
      .where(eq(flyers.id, id))
      .returning({
        id: flyers.id,
        data: flyers.data,
        updatedAt: flyers.updatedAt,
      });
    if (!updated) throw new HttpError(404, "El folleto ya no está guardado.");
    return json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    await requireAdmin(request);
    const id = z.uuid().parse((await params).id);
    await getDb().delete(flyers).where(eq(flyers.id, id));
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
