"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de administración"
      className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pt-6 sm:px-6 lg:px-8"
    >
      {[
        ["/admin", "Viajes y contenido"],
        ["/admin/recibos", "Recibos"],
        ["/admin/egresos", "Egresos"],
        ["/admin/estadisticas", "Estadísticas"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={pathname === href ? "btn-primary" : "btn-secondary"}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
