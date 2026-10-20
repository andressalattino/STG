import {
  ArrowLeft,
  ArrowRight,
  Compass,
  MapPin,
  MessageCircle,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { MediaImage, PdfLink } from "@/components/Media";
import type { Page } from "@/components/site/navigation";
import { getMapDestinations } from "@/data/map-destinations";
import { whatsappUrl } from "@/data/site";
import { documentUrl } from "@/lib/local-files";
import type { Trip } from "@/types";

export function DestinationExplorer({
  trips,
  onNavigate,
}: {
  trips: Trip[];
  onNavigate: (page: Page) => void;
}) {
  const [selectedId, setSelectedId] = useState("bariloche");
  const available = getMapDestinations(trips);

  if (available.length === 0) return null;

  const selectedIndex = Math.max(
    0,
    available.findIndex((destination) => destination.id === selectedId),
  );
  const selected = available[selectedIndex];
  const inquiryUrl = `${whatsappUrl}?text=${encodeURIComponent(
    selected.isDemo
      ? `Hola STG, quisiera consultar opciones para viajar a ${selected.name}.`
      : `Hola STG, quisiera información sobre el paquete ${selected.trip.title} (${selected.name}).`,
  )}`;

  function moveSelection(direction: number) {
    const next =
      (selectedIndex + direction + available.length) % available.length;
    setSelectedId(available[next].id);
  }

  return (
    <section
      id="explora-destinos"
      aria-labelledby="destination-explorer-heading"
      className="scroll-mt-24 overflow-hidden bg-[#07384f] py-14 text-white sm:py-20"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-x-10 gap-y-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-x-16 lg:gap-y-0 lg:px-8">
        <header className="order-1 lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-stg-yellow">
            Inspiración · Explorá con STG
          </p>
          <h2
            id="destination-explorer-heading"
            className="mt-5 max-w-lg text-3xl font-black leading-tight sm:text-4xl lg:text-5xl"
          >
            Tu próximo viaje empieza en el mapa.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/75">
            Cada lugar, una nueva historia. Tocá los puntos del mapa y descubrí
            nuestras propuestas para viajar con STG.
          </p>
        </header>

        <figure className="order-2 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="relative overflow-hidden rounded-xl bg-[#fbf7ed] px-3 pb-3 pt-12 shadow-[0_24px_70px_rgba(0,0,0,0.15)] sm:px-6">
            <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3 text-[#1a4458]">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] sm:text-xs">
                Latinoamérica
              </span>
              <Compass size={22} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="relative mx-auto aspect-[27/35] w-full max-w-[420px]">
              <MediaImage
                src="/maps/latin-america.svg"
                alt="Mapa de Latinoamérica con sus países delimitados"
                width={540}
                height={700}
                loading="lazy"
                className="absolute inset-0 h-full w-full"
              />
              <svg
                viewBox="0 0 540 700"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {available.map((destination) => (
                  <g key={destination.id}>
                    <line
                      x1={(destination.longitude + 120) * 6}
                      y1={(34 - destination.latitude) * 7.5}
                      x2={destination.markerX * 5.4}
                      y2={destination.markerY * 7}
                      stroke="#d49c12"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={(destination.longitude + 120) * 6}
                      cy={(34 - destination.latitude) * 7.5}
                      r="3.5"
                      fill="#facd32"
                    />
                  </g>
                ))}
              </svg>
              {available.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  aria-label={`Ver paquete en ${destination.name}: ${destination.trip.title}`}
                  aria-pressed={destination.id === selected.id}
                  aria-controls="destination-package"
                  title={destination.name}
                  onClick={() => setSelectedId(destination.id)}
                  style={{
                    left: `${destination.markerX}%`,
                    top: `${destination.markerY}%`,
                  }}
                  className={`absolute inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[#07384f] shadow-md transition-colors focus-visible:outline-[#07384f] ${
                    destination.id === selected.id
                      ? "z-20 bg-stg-yellow ring-4 ring-stg-yellow/30"
                      : "z-10 bg-white hover:bg-stg-yellow"
                  }`}
                >
                  <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
                </button>
              ))}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[3%] top-[44%] text-[9px] font-medium uppercase tracking-[0.2em] text-[#1a4458]/50 sm:text-[10px]"
              >
                Océano Pacífico
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-[38%] text-[9px] font-medium uppercase tracking-[0.2em] text-[#1a4458]/50 sm:text-[10px]"
              >
                Océano Atlántico
              </span>
            </div>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-white/65">
            <span>Tocá los + y encontrá tu próximo destino.</span>
            <span>Mapa ilustrativo</span>
          </figcaption>
        </figure>

        <div className="order-3 mx-auto w-full max-w-[520px] lg:col-start-1 lg:row-start-2 lg:max-w-none lg:self-start">
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/20 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
              Destinos para descubrir
            </p>
            <span className="text-sm font-bold tabular-nums text-stg-yellow">
              {String(selectedIndex + 1).padStart(2, "0")}
              <span className="mx-2 text-white/40">/</span>
              {String(available.length).padStart(2, "0")}
            </span>
          </div>

          <div
            id="destination-package"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 overflow-hidden rounded-xl bg-surface p-3 text-foreground shadow-xl"
          >
            <article
              key={selected.trip.id}
              className="grid items-center gap-4 min-[480px]:grid-cols-2"
            >
              <div className="aspect-[4/5] min-w-0 overflow-hidden rounded-lg bg-white">
                <MediaImage
                  src={selected.trip.imageUrl}
                  fallbackSrc={selected.imageUrl}
                  alt={selected.trip.title}
                  showLoading
                  loading="lazy"
                  sizes="(min-width: 1280px) 240px, (min-width: 1024px) 24vw, (min-width: 480px) 240px, calc(100vw - 56px)"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0 px-2 pb-2 min-[480px]:py-3 min-[480px]:pl-0">
                <p className="flex items-center gap-1.5 text-xs font-bold text-stg-blue">
                  <MapPin size={14} className="shrink-0" aria-hidden="true" />
                  {selected.name} · {selected.country}
                </p>
                <h3 className="mt-3 break-words text-3xl font-black leading-tight">
                  {selected.trip.title}
                </h3>
                {selected.isDemo && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Vista de prueba · a definir
                  </p>
                )}
                <p className="mt-3 break-words text-sm leading-6 text-muted">
                  {selected.trip.description}
                </p>
                {selected.isDemo && selected.id === "carlos-paz" && (
                  <p className="mt-2 text-[10px] text-muted">
                    Foto:{" "}
                    <a
                      href="https://commons.wikimedia.org/wiki/File:Villa_Carlos_Paz.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Luluenvacaciones
                    </a>
                    {" · "}
                    <a
                      href="https://creativecommons.org/licenses/by-sa/4.0/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      CC BY-SA 4.0
                    </a>
                    {" · "}adaptada a WebP.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={inquiryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full px-3 text-sm"
                    aria-label={`Consultar por ${selected.isDemo ? selected.name : selected.trip.title} en WhatsApp`}
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {selected.isDemo
                      ? "Consultar destino"
                      : "Consultar paquete"}
                  </a>
                  {documentUrl(selected.trip.pdfUrl) && (
                    <PdfLink value={selected.trip.pdfUrl} />
                  )}
                </div>
              </div>
            </article>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveSelection(-1)}
                disabled={available.length < 2}
                aria-label="Destino anterior"
                aria-controls="destination-package"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/30 transition hover:bg-white/10 focus-visible:outline-white"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => moveSelection(1)}
                disabled={available.length < 2}
                aria-label="Destino siguiente"
                aria-controls="destination-package"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/30 transition hover:bg-white/10 focus-visible:outline-white"
              >
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("viajes")}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline-offset-4 hover:underline focus-visible:outline-white"
            >
              Ver todos los viajes
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
