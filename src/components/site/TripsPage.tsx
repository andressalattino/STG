import { MessageCircle } from "lucide-react";
import { MediaImage, PdfLink } from "@/components/Media";
import { whatsappUrl } from "@/data/site";
import type { Trip } from "@/types";
import { PageHeader } from "./shared";
export function TripsPage({ trips }: { trips: Trip[] }) {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="soft-panel overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <PageHeader
              eyebrow="Viajes actuales"
              title="Salidas disponibles y propuestas vigentes"
              text="Descubri nuestras proximas salidas. Consulta el programa de cada viaje y contactanos para conocer disponibilidad y medios de pago."
            />
            <div className="rounded-lg border border-line bg-tint p-5 text-foreground">
              <p className="text-sm font-black text-stg-blue">
                Asesoramiento directo
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Consulta disponibilidad, medios de pago y detalles antes de
                reservar.
              </p>
              <a
                href={whatsappUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-stg-yellow px-4 py-2 text-sm font-black text-ink"
              >
                WhatsApp
                <MessageCircle size={16} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {trips.map((trip) => (
            <article
              key={trip.id}
              className="group overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.14)]"
            >
              <div className="relative overflow-hidden">
                <MediaImage
                  src={trip.imageUrl || "/logo-stg.png"}
                  alt={trip.title}
                  className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                />
                {trip.featured && (
                  <span className="absolute left-4 top-4 rounded-md bg-stg-yellow px-3 py-1 text-xs font-black text-ink">
                    Destacado
                  </span>
                )}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-black text-foreground">
                  {trip.title}
                </h2>
                <p className="mt-3 min-h-24 text-sm leading-6 text-muted">
                  {trip.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PdfLink value={trip.pdfUrl} />
                  <a
                    href={whatsappUrl}
                    className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-bold text-foreground transition hover:border-line hover:bg-subtle"
                  >
                    Consultar
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
