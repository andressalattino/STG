import { supabase } from "./supabase-client";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  if (data.session)
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error ?? "No se pudo completar la solicitud.",
      response.status,
    );
  }
  return response;
}
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return (await authenticatedFetch(path, init)).json() as Promise<T>;
}
