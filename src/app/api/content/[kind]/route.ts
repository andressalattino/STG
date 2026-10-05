import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { comments, passengerPhotos, trips } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError, json, readJson } from "@/server/http";

const kindSchema = z.enum(["trips", "photos", "comments"]);
const idSchema = z.string().min(1).max(100);
const mediaUrl = z
  .string()
  .max(2048)
  .refine(
    (v) => v === "" || /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v),
    "Usá una URL HTTP/HTTPS válida o una ruta del sitio.",
  );
const tripSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  imageUrl: mediaUrl.pipe(z.string().min(1)),
  pdfUrl: mediaUrl,
  featured: z.boolean().default(false),
});
const photoSchema = tripSchema.omit({ pdfUrl: true, featured: true });
const commentSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(100),
  trip: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(2000),
});
type Context = { params: Promise<{ kind: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const kind = kindSchema.parse((await context.params).kind);
    const db = getDb();
    const data =
      kind === "trips"
        ? await db.select().from(trips).orderBy(desc(trips.createdAt))
        : kind === "photos"
          ? await db
              .select()
              .from(passengerPhotos)
              .orderBy(desc(passengerPhotos.createdAt))
          : await db.select().from(comments).orderBy(desc(comments.createdAt));
    return json(data.map((row) => ({ ...row, source: "supabase" })));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const kind = kindSchema.parse((await context.params).kind);
    const input = await readJson(request);
    const db = getDb();
    if (kind === "trips") {
      const data = tripSchema.parse(input);
      const [row] = await db
        .insert(trips)
        .values(data)
        .onConflictDoUpdate({
          target: trips.id,
          set: { ...data, updatedAt: new Date() },
        })
        .returning();
      return json({ ...row, source: "supabase" });
    }
    if (kind === "photos") {
      const data = photoSchema.parse(input);
      const [row] = await db
        .insert(passengerPhotos)
        .values(data)
        .onConflictDoUpdate({
          target: passengerPhotos.id,
          set: { ...data, updatedAt: new Date() },
        })
        .returning();
      return json({ ...row, source: "supabase" });
    }
    const parsed = commentSchema.parse(input);
    const data = { ...parsed, id: parsed.id ?? randomUUID() };
    const [row] = await db
      .insert(comments)
      .values(data)
      .onConflictDoUpdate({ target: comments.id, set: data })
      .returning();
    return json({ ...row, source: "supabase" });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const kind = kindSchema.parse((await context.params).kind);
    const id = idSchema.parse(new URL(request.url).searchParams.get("id"));
    const db = getDb();
    const table =
      kind === "trips" ? trips : kind === "photos" ? passengerPhotos : comments;
    const deleted = await db
      .delete(table)
      .where(eq(table.id, id))
      .returning({ id: table.id });
    if (!deleted.length) throw new HttpError(404, "El registro ya no existe.");
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
