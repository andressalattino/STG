import {
  ArrowRight,
  CalendarDays,
  Clock,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { MediaImage } from "@/components/Media";
import type { Page } from "@/components/site/navigation";
import { whatsappUrl } from "@/data/site";
import type { Trip } from "@/types";
import { DestinationExplorer } from "./DestinationExplorer";
import { Metric } from "./shared";

type HomePageProps = {
  trips: Trip[];
  featuredTrips: Trip[];
  destinationTiles: Trip[];
  onNavigate: (page: Page) => void;
};

export function HomePage({
  trips,
  featuredTrips,
  destinationTiles,
  onNavigate,
}: HomePageProps) {
  return (
    <div>
      <section className="relative overflow-hidden bg-surface transition-colors">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-stg-yellow/10 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:min-h-[680px] lg:grid-cols-[1fr_0.92fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">STG Viajes y Turismo</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              Viajes organizados con criterio, cercania y acompanamiento real.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Una experiencia profesional desde la primera consulta: destinos
              seleccionados, informacion clara, proveedores confiables y
              coordinacion para viajar con tranquilidad.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={whatsappUrl} className="btn-primary">
                <MessageCircle size={20} />
                Asesoramiento personal
              </a>
              <button
                type="button"
                onClick={() => onNavigate("viajes")}
                className="btn-ghost"
              >
                Ver viajes
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="mt-10 grid max-w-2xl divide-y divide-line rounded-lg border border-line bg-surface shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-4">
                <Clock size={24} className="text-stg-blue" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-foreground">
                  Atención 24/7
                </p>
              </div>
              <div className="p-4">
                <SlidersHorizontal
                  size={24}
                  className="text-stg-blue"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-bold text-foreground">
                  Armado a tu medida
                </p>
              </div>
              <div className="p-4">
                <ShieldCheck
                  size={24}
                  className="text-stg-blue"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-bold text-foreground">
                  Asistencia durante todo el viaje
                </p>
              </div>
            </div>
          </div>

          <div className="grid content-center gap-4">
            <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
              <div className="border-b border-line px-4 py-3">
                <span className="inline-flex rounded-md bg-stg-yellow px-3 py-1 text-xs font-black text-ink">
                  Viaje destacado
                </span>
              </div>
              <div className="bg-subtle">
                <div className="mx-auto aspect-[4/5] w-full max-w-[400px]">
                  <MediaImage
                    src={featuredTrips[0]?.imageUrl || "/logo-stg.png"}
                    alt={featuredTrips[0]?.title || "STG Viajes"}
                    loading="eager"
                    fetchPriority="high"
                    sizes="(max-width: 432px) calc(100vw - 32px), 400px"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              <div className="border-t border-line p-5 text-foreground">
                <p className="text-sm font-bold text-stg-blue">Salida actual</p>
                <h2 className="mt-2 line-clamp-2 h-[72px] text-3xl font-black leading-9">
                  {featuredTrips[0]?.title || "Proxima salida"}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {destinationTiles.slice(0, 3).map((trip) => (
                <div
                  key={trip.id}
                  className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
                >
                  <div className="aspect-[4/5] bg-subtle">
                    <MediaImage
                      src={trip.imageUrl}
                      alt={trip.title}
                      showLoading
                      sizes="(max-width: 1023px) 33vw, 200px"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <p className="truncate text-sm font-black text-foreground">
                      {trip.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-subtle/80 py-8 transition-colors">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <Metric
            icon={<ShieldCheck size={22} />}
            title="Coordinacion completa"
            text="Planificacion, reservas e informacion centralizada."
          />
          <Metric
            icon={<UsersRound size={22} />}
            title="Viajes grupales"
            text="Acompanamiento para pasajeros y grupos."
          />
          <Metric
            icon={<CalendarDays size={22} />}
            title="Salidas actuales"
            text="Propuestas listas para consultar y reservar."
          />
        </div>
      </section>

      <DestinationExplorer trips={trips} onNavigate={onNavigate} />

      <section className="bg-surface py-16 transition-colors sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">Destinos destacados</p>
            <h2 className="mt-3 text-3xl font-black text-foreground">
              Ideas para tu proximo viaje
            </h2>
          </div>
          <div className="mx-auto mt-8 grid max-w-[400px] auto-rows-fr gap-5 md:max-w-none md:grid-cols-2 lg:grid-cols-3">
            {destinationTiles.slice(0, 3).map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => onNavigate("viajes")}
                className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left shadow-[0_22px_60px_rgba(15,23,42,0.14)] transition hover:border-stg-blue"
              >
                <div className="aspect-[4/5] w-full bg-subtle">
                  <MediaImage
                    src={trip.imageUrl}
                    alt={trip.title}
                    showLoading
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 400px"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex h-[88px] w-full shrink-0 items-center justify-between gap-3 border-t border-line p-4 text-foreground">
                  <p
                    className="line-clamp-2 text-xl font-black leading-7"
                    title={trip.title}
                  >
                    {trip.title}
                  </p>
                  <ArrowRight
                    size={20}
                    className="shrink-0 text-stg-blue"
                    aria-hidden="true"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
