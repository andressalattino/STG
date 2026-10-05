import {
  ArrowRight,
  CalendarDays,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { MediaImage } from "@/components/Media";
import type { Page } from "@/components/site/navigation";
import { companyAddress, mapsUrl, whatsappUrl } from "@/data/site";
import type { Trip } from "@/types";
import { Metric } from "./shared";

type HomePageProps = {
  featuredTrips: Trip[];
  destinationTiles: Trip[];
  onNavigate: (page: Page) => void;
};

export function HomePage({
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
            <div className="mt-10 grid max-w-2xl grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface shadow-sm">
              <div className="p-4">
                <p className="text-2xl font-black text-foreground">24/7</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  Atencion
                </p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver ubicacion en Google Maps: ${companyAddress}`}
                className="p-4 transition hover:bg-subtle"
              >
                <MapPin
                  size={24}
                  className="text-stg-blue"
                  aria-hidden="true"
                />
                <p className="mt-1 text-xs font-bold uppercase text-foreground">
                  Ubicacion
                </p>
                <p className="mt-1 text-xs text-muted">
                  Las Heras 418, Mendoza
                </p>
              </a>
              <div className="p-4">
                <p className="text-2xl font-black text-foreground">STG</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  Turismo
                </p>
              </div>
            </div>
          </div>

          <div className="grid content-center gap-4">
            <div className="relative overflow-hidden rounded-lg bg-gray-950 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
              <MediaImage
                src={featuredTrips[0]?.imageUrl || "/logo-stg.png"}
                alt={featuredTrips[0]?.title || "STG Viajes"}
                className="h-[460px] w-full object-cover opacity-88"
              />
              <div className="absolute left-5 top-5 rounded-md bg-surface/95 px-4 py-2 text-sm font-black text-foreground backdrop-blur">
                Viaje destacado
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent p-6 text-white">
                <p className="text-sm font-bold text-stg-yellow">
                  Salida actual
                </p>
                <h2 className="mt-2 text-3xl font-black">
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
                  <MediaImage
                    src={trip.imageUrl}
                    alt={trip.title}
                    className="h-28 w-full object-cover opacity-90"
                  />
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

      <section className="bg-surface py-16 transition-colors sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="eyebrow">Destinos destacados</p>
            <h2 className="mt-3 text-3xl font-black text-foreground">
              Ideas para tu proximo viaje
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {destinationTiles.slice(0, 3).map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => onNavigate("viajes")}
                className="group relative h-80 overflow-hidden rounded-lg bg-gray-950 text-left shadow-[0_22px_60px_rgba(15,23,42,0.14)]"
              >
                <MediaImage
                  src={trip.imageUrl}
                  alt={trip.title}
                  className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 p-5 text-white">
                  <p className="text-2xl font-black">{trip.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
