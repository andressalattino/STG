"use client";

import {
  ArrowUpRight,
  ChartNoAxesCombined,
  FileSignature,
  FileText,
  House,
  Images,
  LogOut,
  MapPinned,
  MessageSquare,
  PanelsTopLeft,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    title: "Contenido de la web",
    sections: [
      {
        path: "/admin/viajes",
        label: "Viajes",
        icon: MapPinned,
        description:
          "Editá los viajes publicados y destacá salidas en el inicio.",
      },
      {
        path: "/admin/fotos",
        label: "Fotos",
        icon: Images,
        description: "Administrá la galería de fotos de pasajeros.",
      },
      {
        path: "/admin/comentarios",
        label: "Comentarios",
        icon: MessageSquare,
        description: "Publicá y editá los testimonios de la comunidad.",
      },
    ],
  },
  {
    title: "Operación de la agencia",
    sections: [
      {
        path: "/admin/folletos",
        label: "Folletos",
        icon: PanelsTopLeft,
        description: "Diseñá, guardá e imprimí cuatro folletos por hoja A4.",
      },
      {
        path: "/admin/recibos",
        label: "Recibos",
        icon: Receipt,
        description: "Emití comprobantes y consultá los recibos guardados.",
      },
      {
        path: "/admin/cotizaciones",
        label: "Cotizaciones",
        icon: FileText,
        description: "Prepará propuestas de viaje a medida.",
      },
      {
        path: "/admin/contratos",
        label: "Contratos",
        icon: FileSignature,
        description: "Generá contratos y consultá sus versiones.",
      },
      {
        path: "/admin/egresos",
        label: "Egresos",
        icon: Wallet,
        description: "Registrá y consultá los gastos de la agencia.",
      },
      {
        path: "/admin/estadisticas",
        label: "Estadísticas",
        icon: ChartNoAxesCombined,
        description: "Consultá los ingresos, egresos y saldos por período.",
      },
    ],
  },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const links = [
    { path: "/admin", label: "Inicio del admin", icon: House },
    ...groups.flatMap((group) => group.sections),
  ];

  return (
    <nav
      aria-label="Secciones de administración"
      className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8"
    >
      <ul className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface p-2">
        {links.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              href={path}
              prefetch={false}
              aria-current={pathname === path ? "page" : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-muted transition hover:bg-tint hover:text-foreground aria-[current=page]:bg-tint aria-[current=page]:text-foreground"
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminHome({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-5 rounded-lg border border-line border-l-4 border-l-stg-yellow bg-tint px-5 py-6 sm:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">
            STG Turismo
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Panel de administración
          </h1>
          <p className="mt-2 text-muted">
            Elegí la sección que querés gestionar.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={onLogout}>
          <LogOut aria-hidden="true" size={16} /> Cerrar sesión
        </button>
      </header>
      {groups.map(({ title, sections }) => (
        <section key={title} aria-label={title}>
          <h2 className="mb-3 text-lg font-black">{title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map(({ path, label, icon: Icon, description }) => (
              <li key={path}>
                <Link
                  href={path}
                  prefetch={false}
                  className="surface-card group flex h-full items-start gap-4 p-4 transition hover:border-stg-blue sm:p-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-tint text-stg-blue">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black">{label}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted">
                      {description}
                    </p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    size={16}
                    className="mt-1 shrink-0 text-muted group-hover:text-stg-blue"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
