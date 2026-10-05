import "server-only";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { HttpError } from "./http";

export async function requireAdmin(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Iniciá sesión para continuar.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new HttpError(503, "Falta configurar Supabase Auth.");
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, "Tu sesión venció. Volvé a iniciar sesión.");
  const [admin] = await getDb()
    .select({ id: admins.userId })
    .from(admins)
    .where(eq(admins.userId, data.user.id))
    .limit(1);
  if (!admin)
    throw new HttpError(403, "Tu cuenta no tiene permisos de administrador.");
  return { id: data.user.id, email: data.user.email };
}
