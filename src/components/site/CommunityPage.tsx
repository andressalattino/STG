import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { MediaImage } from "@/components/Media";
import { commentsEmail, companyAddress, mapsUrl } from "@/data/site";
import type { Comment, PassengerPhoto } from "@/types";
import { Metric, PageHeader, SocialLinks } from "./shared";

type CommunityPageProps = {
  comments: Comment[];
  activeImage: number;
  passengerPhotos: PassengerPhoto[];
  onNextImage: (direction: number) => void;
};

export function CommunityPage({
  activeImage,
  passengerPhotos,
  onNextImage,
  comments,
}: CommunityPageProps) {
  const activePhoto = passengerPhotos[activeImage] || passengerPhotos[0];

  return (
    <div>
      <section className="bg-surface py-12 transition-colors sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <PageHeader
              eyebrow="Sobre nosotros"
              title="Una empresa de turismo enfocada en confianza, detalle y experiencia."
              text="STG acompana a sus pasajeros con propuestas organizadas, informacion clara y una atencion cercana. La diferencia esta en combinar gestion seria con trato humano para que el viaje empiece bien desde la consulta."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Metric
                icon={<ShieldCheck size={20} />}
                title="Experiencia"
                text="Procesos claros y proveedores confiables."
              />
              <Metric
                icon={<MessageCircle size={20} />}
                title="Cercania"
                text="Asesoramiento antes y durante el viaje."
              />
              <Metric
                icon={<BarChart3 size={20} />}
                title="Organizacion"
                text="Detalle, seguimiento y comunicacion."
              />
            </div>
            <div className="mt-8">
              <SocialLinks />
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="group rounded-lg border border-line bg-subtle p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-line"
          >
            <div className="flex min-h-[360px] flex-col justify-between rounded-lg border border-line bg-surface p-6">
              <div>
                <MapPin className="text-stg-blue" size={36} />
                <h2 className="mt-5 text-2xl font-black text-foreground">
                  Ubicacion STG
                </h2>
                <p className="mt-3 leading-7 text-muted">{companyAddress}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-md bg-stg-yellow px-4 py-2 text-sm font-black text-ink">
                Abrir en Maps
                <ExternalLink size={16} />
              </span>
            </div>
          </a>
        </div>
      </section>

      <section className="py-16 transition-colors sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Nuestros pasajeros"
            title="Fotos, experiencias y comentarios reales"
            text="Recuerdos compartidos y experiencias de quienes eligieron viajar con STG."
          />

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-950 shadow-[0_25px_70px_rgba(15,23,42,0.18)] sm:aspect-[16/10] lg:aspect-[16/9]">
              <MediaImage
                src={activePhoto?.imageUrl || "/logo-stg.png"}
                alt={activePhoto?.title || "Pasajeros viajando con STG"}
                className="h-full w-full object-cover opacity-95"
              />
              {activePhoto && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950/85 to-transparent p-5 text-white">
                  <h2 className="text-xl font-black">{activePhoto.title}</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-gray-200">
                    {activePhoto.description}
                  </p>
                </div>
              )}
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={() => onNextImage(-1)}
                disabled={passengerPhotos.length < 2}
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-surface/95 text-foreground shadow transition hover:bg-stg-yellow hover:text-ink sm:left-4 sm:h-11 sm:w-11"
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                aria-label="Foto siguiente"
                onClick={() => onNextImage(1)}
                disabled={passengerPhotos.length < 2}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-surface/95 text-foreground shadow transition hover:bg-stg-yellow hover:text-ink sm:right-4 sm:h-11 sm:w-11"
              >
                <ChevronRight />
              </button>
            </div>

            <div className="grid gap-4">
              {comments.map((comment) => (
                <article
                  key={`${comment.name}-${comment.trip}`}
                  className="rounded-lg border border-line bg-surface p-5 shadow-[0_14px_35px_rgba(15,23,42,0.07)]"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-stg-blue">
                    {comment.trip}
                  </p>
                  <p className="mt-3 leading-7 text-muted">"{comment.text}"</p>
                  <p className="mt-3 font-black text-foreground">
                    {comment.name}
                  </p>
                </article>
              ))}
              <a
                href={`mailto:${commentsEmail}?subject=Comentario%20o%20foto%20para%20STG`}
                className="btn-primary"
              >
                <Mail size={20} />
                Dejar comentario
              </a>
              <p className="text-sm leading-6 text-muted">
                Envianos tu comentario o fotos del viaje a {commentsEmail}. Si
                no se abre tu aplicacion de correo, podes escribirnos
                directamente a esa direccion.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
