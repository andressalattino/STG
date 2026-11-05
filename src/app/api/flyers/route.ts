import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { flyers } from "@/db/schema";
import { flyerSchema } from "@/features/flyers/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError, json, readJson } from "@/server/http";

export const runtime = "nodejs";

const record = {
  id: flyers.id,
  data: flyers.data,
  updatedAt: flyers.updatedAt,
};
const createSchema = z.object({ id: z.uuid(), data: flyerSchema });

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return json(
      await getDb()
        .select(record)
        .from(flyers)
        .orderBy(desc(flyers.updatedAt), desc(flyers.id)),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const { id, data } = createSchema.parse(await readJson(request));
    const db = getDb();
    const [created] = await db
      .insert(flyers)
      .values({ id, data, createdBy: admin.id })
      .onConflictDoNothing({ target: flyers.id })
      .returning(record);
    if (created) return json(created, 201);

    const [existing] = await db
      .select(record)
      .from(flyers)
      .where(eq(flyers.id, id));
    if (
      existing &&
      JSON.stringify(flyerSchema.parse(existing.data)) === JSON.stringify(data)
    ) {
      return json(existing);
    }
    throw new HttpError(
      409,
      "El folleto ya fue guardado. Actualizá la lista para volver a abrirlo.",
    );
  } catch (error) {
    return apiError(error);
  }
}
