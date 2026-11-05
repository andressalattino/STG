import { Globe2, Phone } from "lucide-react";
import Image from "next/image";
import { flyerDuration, hotelSlots } from "./domain";

export type FlyerDraft = {
  title: string;
  days: string;
  nights: string;
  transport: string;
  company: string;
  hotels: { name: string; date: string; price: string }[];
};

const prices = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  trailingZeroDisplay: "stripIfInteger",
});

function formatPrice(value: string) {
  const amount = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(amount) ? prices.format(amount) : "";
}

export function FlyerPreview({ draft }: { draft: FlyerDraft }) {
  const title = draft.title.trim() || "Nombre del viaje";
  const duration =
    draft.days && draft.nights
      ? flyerDuration(Number(draft.days), Number(draft.nights))
      : "";
  const transport = [draft.company.trim(), draft.transport]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flyer-art">
      <div className="flyer-brand">
        <Image
          src="/logo-stg.png"
          alt="STG Turismo"
          width={149}
          height={82}
          unoptimized
          loading="eager"
        />
        <p>
          Viajá con
          <br />
          nosotros
        </p>
      </div>
      <div className="flyer-destination">
        <p>Descubrí tu próximo destino</p>
        <h3
          data-size={
            title.length > 47
              ? "small"
              : title.length > 22
                ? "medium"
                : undefined
          }
        >
          {title}
        </h3>
        <span>Tu viaje empieza acá</span>
      </div>
      <dl className="flyer-details">
        <div>
          <dt>Duración</dt>
          <dd>{duration}</dd>
        </div>
        <div>
          <dt>Transporte</dt>
          <dd>{transport}</dd>
        </div>
      </dl>
      <div className="flyer-hotels">
        <div className="flyer-hotel-heading">
          <h4>Opciones de hotel</h4>
          <span>4 alternativas</span>
        </div>
        <ol>
          {hotelSlots.map((slot) => {
            const hotel = draft.hotels[slot];
            const [year, month, day] = hotel.date.split("-");
            const name = hotel.name.trim();
            return (
              <li key={slot}>
                <span className="flyer-hotel-index" aria-hidden="true">
                  0{slot + 1}
                </span>
                <div className="flyer-hotel-info">
                  <p
                    className="flyer-hotel-name"
                    data-long={name.length > 40 || undefined}
                  >
                    {name}
                  </p>
                  <p className="flyer-hotel-meta">
                    <span>
                      {day ? `${day}/${month}/${year.slice(-2)}` : ""}
                    </span>
                    <strong>{formatPrice(hotel.price)}</strong>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flyer-contact">
        <p>Consultas y reservas</p>
        <span>
          <Phone aria-hidden="true" /> 261.5458242
        </span>
        <span>
          <Globe2 aria-hidden="true" /> https://stg-turismo.vercel.app/
        </span>
      </div>
    </article>
  );
}
