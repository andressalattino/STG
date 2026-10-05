import { Menu, Moon, Sun, X } from "lucide-react";
import { MediaImage } from "@/components/Media";
import type { Page } from "@/components/site/navigation";
import { pageTitles } from "./navigation";

type HeaderProps = {
  currentPage: Page;
  darkMode: boolean;
  mobileMenuOpen: boolean;
  onToggleDarkMode: () => void;
  onToggleMenu: () => void;
  onNavigate: (page: Page) => void;
};

export function Header({
  currentPage,
  darkMode,
  mobileMenuOpen,
  onToggleDarkMode,
  onToggleMenu,
  onNavigate,
}: HeaderProps) {
  const publicPages: Page[] = ["inicio", "viajes", "comunidad"];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate("inicio")}
          className="flex items-center gap-3 rounded-md px-1 py-1 transition hover:bg-subtle"
        >
          <MediaImage
            src="/logo-stg.png"
            alt="STG Viajes y Turismo"
            className="h-12 w-auto sm:h-14"
          />
          <span className="hidden text-left text-xs font-black uppercase tracking-[0.18em] text-stg-blue sm:block">
            Viajes y Turismo
          </span>
        </button>

        <div className="hidden items-center gap-1 rounded-lg border border-line bg-subtle/80 p-1 md:flex">
          {publicPages.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onNavigate(item)}
              className={`rounded-md px-4 py-2.5 text-sm font-bold transition ${
                currentPage === item
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:bg-surface/60 hover:text-foreground"
              }`}
            >
              {pageTitles[item]}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-foreground shadow-sm transition hover:border-line"
            aria-label={darkMode ? "Tema oscuro activo" : "Tema claro activo"}
            title={darkMode ? "Tema oscuro" : "Tema claro"}
          >
            {darkMode ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface text-foreground shadow-sm"
            aria-label={darkMode ? "Tema oscuro activo" : "Tema claro activo"}
          >
            {darkMode ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button
            type="button"
            onClick={onToggleMenu}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface shadow-sm"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="border-t border-line bg-surface px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {publicPages.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onNavigate(item)}
                className={`rounded-md px-3 py-3 text-left text-sm font-bold ${
                  currentPage === item
                    ? "bg-stg-yellow text-ink"
                    : "bg-subtle text-foreground"
                }`}
              >
                {pageTitles[item]}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
