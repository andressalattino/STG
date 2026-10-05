export type RecoveryLink =
  | { kind: "token"; token: string }
  | { kind: "session"; access_token: string; refresh_token: string };

export function parseRecoveryLink(
  value: string,
  projectUrl: string,
  siteOrigin: string,
): RecoveryLink {
  const invalid = () => new Error("INVALID_RECOVERY_LINK");
  let link: URL;
  try {
    link = new URL(value.trim());
    if (
      link.protocol === "https:" &&
      link.hostname.endsWith(".safelinks.protection.outlook.com")
    ) {
      link = new URL(link.searchParams.get("url") ?? "");
    }
  } catch {
    throw invalid();
  }
  if (link.username || link.password) throw invalid();
  if (
    link.origin === new URL(projectUrl).origin &&
    link.pathname === "/auth/v1/verify" &&
    link.searchParams.get("type") === "recovery"
  ) {
    const token = link.searchParams.get("token");
    if (token && /^[a-zA-Z0-9_-]{20,512}$/.test(token))
      return { kind: "token", token };
  }
  const origins = new Set([siteOrigin]);
  if (["localhost", "127.0.0.1"].includes(new URL(siteOrigin).hostname)) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  if (origins.has(link.origin)) {
    const hash = new URLSearchParams(link.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (
      hash.get("type") === "recovery" &&
      access_token &&
      /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(access_token) &&
      refresh_token &&
      /^[a-zA-Z0-9_-]{10,512}$/.test(refresh_token)
    ) {
      return { kind: "session", access_token, refresh_token };
    }
  }
  throw invalid();
}

export function recoveryError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  if (message === "INVALID_RECOVERY_LINK")
    return "Pegá el enlace completo del correo de recuperación o la dirección completa a la que te llevó. No sirve la dirección del formulario.";
  if (
    code === "otp_expired" ||
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used"
  )
    return "El enlace venció o ya se usó. Solicitá otro correo y copiá el enlace nuevo sin abrirlo.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  )
    return "Supabase alcanzó el límite temporal de solicitudes. Esperá antes de solicitar otro correo; podés usar el último enlace que recibiste.";
  if (code === "email_address_not_authorized")
    return "Supabase no permite enviar correo a esta dirección. Hace falta configurar el servicio de correo del proyecto.";
  if (code === "weak_password")
    return "Elegí una contraseña más larga que combine letras, números y símbolos.";
  if (code === "same_password")
    return "Elegí una contraseña distinta de la anterior.";
  if (code === "session_not_found" || message === "RECOVERY_SESSION_MISSING")
    return "La sesión de recuperación venció. Volvé a verificar un enlace nuevo.";
  if (
    /fetch|network|timeout|abort/i.test(message) ||
    (error instanceof Error && error.name === "AuthRetryableFetchError")
  )
    return "No se pudo conectar con Supabase. Revisá tu conexión a Internet y volvé a intentar; la contraseña no quedó confirmada.";
  return "Supabase no pudo completar la recuperación. Volvé a intentar y, si persiste, consultá al administrador.";
}
