import { MediaImage } from "@/components/Media";
import type { Page } from "@/components/site/navigation";
import { mapsUrl } from "@/data/site";
import { SocialLinks } from "./shared";
export function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <footer className="border-t border-line bg-surface py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 text-sm text-muted sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onNavigate("inicio")}
            className="flex w-fit items-center gap-3"
          >
            <MediaImage src="/logo-stg.png" alt="STG" className="h-10 w-auto" />
            <span className="font-black text-foreground">
              STG Viajes y Turismo
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => onNavigate("viajes")}>
              Viajes
            </button>
            <button type="button" onClick={() => onNavigate("comunidad")}>
              Comunidad
            </button>
            <a href={mapsUrl}>Maps</a>
            <button type="button" onClick={() => onNavigate("admin")}>
              Administración
            </button>
          </div>
        </div>
        <SocialLinks />
      </div>
    </footer>
  );
}
