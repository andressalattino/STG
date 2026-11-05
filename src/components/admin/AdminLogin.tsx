import { Lock } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";

export function AdminLogin({
  onLogin,
  loginError,
}: {
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  loginError: string;
}) {
  return (
    <section className="min-h-[calc(100vh-180px)] py-12 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-stg-blue">
            Acceso privado
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-5xl">
            Panel administrativo protegido.
          </h1>
          <p className="mt-5 leading-8 text-muted">
            Iniciá sesión para acceder a las herramientas de STG Turismo.
          </p>
        </div>

        <form onSubmit={onLogin} className="surface-card p-6 sm:p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-tint text-foreground">
            <Lock size={24} />
          </div>
          <h2 className="mt-5 text-2xl font-black text-foreground">
            Iniciar sesión
          </h2>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-foreground">
              Correo electrónico
              <input
                name="username"
                type="email"
                autoComplete="username"
                className="admin-input"
                placeholder="tu-correo@ejemplo.com"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-foreground">
              Contraseña
              <input
                name="password"
                type="password"
                className="admin-input"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="btn-primary mt-2">
              <Lock size={18} />
              Entrar al panel
            </button>
            {loginError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                {loginError}
              </p>
            )}
            <Link
              href="/admin/recuperar"
              className="text-sm font-bold underline"
            >
              Olvidé mi contraseña
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
