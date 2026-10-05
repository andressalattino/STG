"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { parseRecoveryLink, recoveryError } from "./recovery";

export default function PasswordRecovery() {
  const client = useRef<SupabaseClient | null>(null);
  const started = useRef(false);
  const inFlight = useRef(false);
  const lastEmail = useRef(0);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function getAuth() {
    if (!client.current) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
      client.current = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "stg-password-recovery",
        },
        global: {
          fetch: (url, init) =>
            fetch(url, { ...init, signal: AbortSignal.timeout(20000) }),
        },
      });
    }
    return client.current.auth;
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(recoveryError(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function verify(value: string) {
    const link = parseRecoveryLink(
      value,
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      window.location.origin,
    );
    const auth = getAuth();
    const result =
      link.kind === "token"
        ? await auth.verifyOtp({ type: "recovery", token_hash: link.token })
        : await auth.setSession({
            access_token: link.access_token,
            refresh_token: link.refresh_token,
          });
    if (result.error) throw result.error;
    const { data, error } = await auth.getUser();
    if (error) throw error;
    if (!data.user?.email) throw new Error("RECOVERY_SESSION_MISSING");
    setVerifiedEmail(data.user.email);
  }

  // Consume and immediately remove recovery credentials from the address bar.
  // The ref prevents a second token exchange during React's development checks.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only inspect the initial URL once
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!window.location.hash) return;
    const initialUrl = window.location.href;
    window.history.replaceState(null, "", window.location.pathname);
    if (hash.get("type") === "recovery") void run(() => verify(initialUrl));
    else if (hash.has("error"))
      setError(
        "El enlace venció o no pudo verificarse. Solicitá un correo nuevo.",
      );
  }, []);

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Date.now() - lastEmail.current < 60000) {
      setError("Esperá un minuto antes de solicitar otro correo.");
      return;
    }
    await run(async () => {
      lastEmail.current = Date.now();
      const { error } = await getAuth().resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/recuperar`,
      });
      if (error) throw error;
      setSent(true);
    });
  }

  async function verifyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = String(new FormData(form).get("link") ?? "");
    form.reset();
    await run(() => verify(value));
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get("password") ?? "");
    if (
      password.length < 12 ||
      password.length > 128 ||
      password !== fields.get("confirmation")
    ) {
      setError(
        "Las contraseñas deben coincidir y tener entre 12 y 128 caracteres.",
      );
      return;
    }
    await run(async () => {
      const auth = getAuth();
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      setDone(true);
      await auth.signOut({ scope: "local" }).catch(() => {});
    });
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-12 text-foreground">
      <section
        className="surface-card mx-auto max-w-xl p-6 sm:p-8"
        aria-busy={busy}
      >
        <Link href="/" className="text-sm font-black tracking-wide">
          STG · VIAJES Y TURISMO
        </Link>
        <h1 className="mt-5 text-3xl font-black">
          {done ? "Contraseña actualizada" : "Recuperar acceso"}
        </h1>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-md bg-danger-soft p-4 text-danger"
          >
            {error}
          </p>
        )}
        {done ? (
          <div className="mt-5 space-y-5">
            <p>
              La contraseña de <strong>{verifiedEmail}</strong> se cambió
              correctamente. Ingresá con tu nueva contraseña.
            </p>
            <Link className="btn-primary" href="/admin/recibos">
              Ir al administrador
            </Link>
          </div>
        ) : verifiedEmail ? (
          <form onSubmit={savePassword} className="mt-5 grid gap-4">
            <p>
              Cuenta verificada: <strong>{verifiedEmail}</strong>
            </p>
            <label className="grid gap-2 font-bold">
              Nueva contraseña
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className="admin-input"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={busy}
              />
            </label>
            <label className="grid gap-2 font-bold">
              Repetí la nueva contraseña
              <input
                name="confirmation"
                type={showPassword ? "text" : "password"}
                className="admin-input"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Mostrar contraseñas
            </label>
            <p className="text-sm text-muted">
              Usá al menos 12 caracteres. Esta contraseña es para ingresar a la
              web.
            </p>
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-7">
            <form onSubmit={sendEmail} className="grid gap-4">
              <label className="grid gap-2 font-bold">
                Correo de tu cuenta
                <input
                  name="email"
                  type="email"
                  className="admin-input"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={busy}
                />
              </label>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy
                  ? "Procesando…"
                  : sent
                    ? "Reenviar correo"
                    : "Enviar correo de recuperación"}
              </button>
              {sent && (
                <p role="status">
                  Si el correo está registrado, recibirás un enlace de
                  recuperación. Revisá también correo no deseado.
                </p>
              )}
            </form>
            <form
              onSubmit={verifyLink}
              className="grid gap-4 border-t border-line pt-6"
            >
              <h2 className="text-lg font-bold">¿Ya tenés el correo?</h2>
              <p>
                Hacé clic derecho en <strong>Reset Password</strong>, copiá la
                dirección del enlace y pegala aquí sin abrirla.
              </p>
              <details className="text-sm text-muted">
                <summary className="cursor-pointer font-bold">
                  El enlace me llevó a Grafana u otra página
                </summary>
                <p className="mt-2">
                  Pegá la dirección completa de esa pestaña, incluyendo lo que
                  aparece después de #. Si ya no tenés esa dirección o el enlace
                  venció, solicitá otro correo y copiá el enlace sin abrirlo.
                </p>
              </details>
              <label className="grid gap-2 font-bold">
                Enlace de recuperación
                <textarea
                  name="link"
                  className="admin-input min-h-24"
                  maxLength={8192}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={busy}
                />
              </label>
              <button className="btn-secondary" type="submit" disabled={busy}>
                Verificar enlace
              </button>
            </form>
          </div>
        )}
        {!done && (
          <Link
            href="/admin/recibos"
            className="mt-7 inline-block text-sm font-bold underline"
          >
            Volver al inicio de sesión
          </Link>
        )}
      </section>
    </main>
  );
}
