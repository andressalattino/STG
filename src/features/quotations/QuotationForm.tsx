"use client";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Field } from "@/components/site/shared";
import { decimalDisplay, type Quote } from "@/features/receipts/domain";
import { ApiError, apiRequest, authenticatedFetch } from "@/lib/api";
import {
  boards,
  type QuotationData,
  type QuotationInput,
  type QuotationRecord,
  quotationDraftSchema,
  quotationInputSchema,
  returnLegs,
  transportTypes,
  tripNights,
} from "./domain";

const leg = () => ({
  key: crypto.randomUUID(),
  mode: "Aéreo" as QuotationData["legs"][number]["mode"],
  from: "",
  to: "",
});
const hotel = () => ({
  key: crypto.randomUUID(),
  name: "",
  board: "Solo desayuno" as QuotationData["board"],
  price: "",
});
function blank(data?: QuotationData) {
  return {
    passenger: "",
    passengers: 1,
    destination: "",
    startDate: "",
    endDate: "",
    currency: "ARS" as "ARS" | "USD",
    amount: "",
    exchangeRate: "1",
    validityHours: 72,
    board: "Solo desayuno" as QuotationData["board"],
    carryOn: 0,
    checkedBags: 0,
    baggageNotes: "",
    transport: "Clásico" as QuotationData["transport"],
    roundTrip: true,
    lodging: true,
    nights: 1,
    assistance: false,
    assistanceName: "",
    assistanceNotes: "",
    transfers: false,
    transferNotes: "",
    excursions: false,
    excursionDetails: "",
    notes: "",
    ...data,
    legs: data
      ? data.legs.map((l) => ({ ...l, key: crypto.randomUUID() }))
      : [leg()],
    hotels:
      data?.lodging === false
        ? []
        : data?.hotels.length
          ? data.hotels.map((h) => ({ ...h, key: crypto.randomUUID() }))
          : [hotel()],
  };
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h3 className="mb-5 text-lg font-black">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
export function QuotationForm({
  initialData,
  onSaved,
}: {
  initialData?: QuotationData;
  onSaved: (q: QuotationRecord) => void;
}) {
  const [form, setForm] = useState(() => blank(initialData));
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState("");
  const [rateBusy, setRateBusy] = useState(false),
    [rateInfo, setRateInfo] = useState("");
  const pending = useRef<QuotationInput | null>(null),
    flight = useRef(false),
    quoteRequest = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      quoteRequest.current?.abort();
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  function change<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  function dates(key: "startDate" | "endDate", value: string) {
    setForm((old) => {
      const next = { ...old, [key]: value };
      return { ...next, nights: tripNights(next.startDate, next.endDate) };
    });
  }
  function moneyCurrency(value: "ARS" | "USD") {
    quoteRequest.current?.abort();
    setRateBusy(false);
    setRateInfo("");
    setForm((old) => ({
      ...old,
      currency: value,
      exchangeRate: value === "ARS" ? "1" : "",
    }));
  }
  async function loadRate() {
    quoteRequest.current?.abort();
    const controller = new AbortController();
    quoteRequest.current = controller;
    setRateBusy(true);
    setRateInfo("");
    try {
      const quote = await apiRequest<Quote>("/api/exchange-rate", {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        change("exchangeRate", quote.value);
        setRateInfo("Dólar oficial de venta. Podés modificarlo.");
      }
    } catch {
      if (!controller.signal.aborted)
        setRateInfo(
          "Ingresá la cotización manualmente; no se pudo consultar el dólar.",
        );
    } finally {
      if (!controller.signal.aborted) setRateBusy(false);
    }
  }
  async function preview() {
    if (flight.current) return;
    const parsed = quotationDraftSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/quotations/preview", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      const url = URL.createObjectURL(await response.blob());
      urls.current.push(url);
      if (tab) tab.location.href = url;
      else
        throw new Error(
          "Permití ventanas emergentes para abrir la vista previa.",
        );
    } catch (e) {
      tab?.close();
      setError(
        e instanceof Error ? e.message : "No se pudo generar la vista previa.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (flight.current) return;
    setError("");
    if (!pending.current) {
      const parsed = quotationInputSchema.safeParse({
        requestId: crypto.randomUUID(),
        data: form,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      pending.current = parsed.data;
    }
    flight.current = true;
    setBusy(true);
    try {
      const { quotation } = await apiRequest<{ quotation: QuotationRecord }>(
        "/api/quotations",
        { method: "POST", body: JSON.stringify(pending.current) },
      );
      pending.current = null;
      setUncertain(false);
      setForm(blank());
      onSaved(quotation);
    } catch (e) {
      const ambiguous = !(e instanceof ApiError) || e.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) pending.current = null;
      setError(
        ambiguous
          ? "No se pudo confirmar el guardado. Reintentá este mismo envío para evitar duplicados."
          : e.message,
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function input(
    key: "passenger" | "destination" | "amount" | "assistanceName",
    label: string,
    maxLength = 120,
  ) {
    return (
      <Field label={label}>
        <input
          aria-label={label}
          className="admin-input"
          value={form[key]}
          maxLength={maxLength}
          required
          onChange={(e) => change(key, e.target.value)}
        />
      </Field>
    );
  }
  function notes(
    key:
      | "baggageNotes"
      | "assistanceNotes"
      | "transferNotes"
      | "excursionDetails"
      | "notes",
    label: string,
    maxLength: number,
  ) {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label={label}>
          <textarea
            aria-label={label}
            className="admin-input min-h-24"
            value={form[key]}
            maxLength={maxLength}
            onChange={(e) => change(key, e.target.value)}
          />
        </Field>
      </div>
    );
  }
  function yesNo(
    key: "lodging" | "assistance" | "transfers" | "excursions",
    label: string,
  ) {
    return (
      <Field label={label}>
        <select
          aria-label={label}
          className="admin-input"
          value={form[key] ? "yes" : "no"}
          onChange={(e) => {
            const yes = e.target.value === "yes";
            if (key === "lodging")
              setForm((old) => ({
                ...old,
                lodging: yes,
                hotels: yes ? [hotel()] : [],
              }));
            else change(key, yes);
          }}
        >
          <option value="yes">
            {key === "transfers" || key === "excursions" ? "Incluidos" : "Sí"}
          </option>
          <option value="no">
            {key === "transfers" || key === "excursions"
              ? "No incluidos"
              : "No"}
          </option>
        </select>
      </Field>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy || uncertain} className="min-w-0 space-y-5">
        <Section title="1. Pasajero y viaje">
          {input("passenger", "Pasajero / familia", 100)}
          <Field label="Cantidad de pasajeros">
            <input
              aria-label="Cantidad de pasajeros"
              className="admin-input"
              type="number"
              min={1}
              max={999}
              required
              value={form.passengers}
              onChange={(e) => change("passengers", Number(e.target.value))}
            />
          </Field>
          {input("destination", "Destino", 160)}
          <Field label="Fecha de salida">
            <input
              aria-label="Fecha de salida"
              className="admin-input"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => dates("startDate", e.target.value)}
            />
          </Field>
          <Field label="Fecha de regreso">
            <input
              aria-label="Fecha de regreso"
              className="admin-input"
              type="date"
              min={form.startDate || undefined}
              required
              value={form.endDate}
              onChange={(e) => dates("endDate", e.target.value)}
            />
          </Field>
          <Field label="Validez (horas)">
            <input
              aria-label="Validez (horas)"
              className="admin-input"
              type="number"
              min={1}
              max={2160}
              required
              value={form.validityHours}
              onChange={(e) => change("validityHours", Number(e.target.value))}
            />
          </Field>
        </Section>
        <Section title="2. Precio y pensión">
          {input("amount", "Precio total", 16)}
          <Field label="Moneda">
            <select
              aria-label="Moneda"
              className="admin-input"
              value={form.currency}
              onChange={(e) => moneyCurrency(e.target.value as "ARS" | "USD")}
            >
              <option>ARS</option>
              <option>USD</option>
            </select>
          </Field>
          <Field label="Cotización a ARS">
            <input
              aria-label="Cotización a ARS"
              className="admin-input"
              inputMode="decimal"
              required
              readOnly={form.currency === "ARS"}
              value={form.exchangeRate}
              onChange={(e) => {
                quoteRequest.current?.abort();
                setRateBusy(false);
                setRateInfo("");
                change("exchangeRate", e.target.value);
              }}
            />
          </Field>
          <Field label="Régimen de pensión">
            <select
              aria-label="Régimen de pensión"
              className="admin-input"
              value={form.board}
              onChange={(e) =>
                change("board", e.target.value as QuotationData["board"])
              }
            >
              {boards.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          {form.currency === "USD" && (
            <div className="self-end">
              <button
                type="button"
                className="btn-secondary"
                disabled={rateBusy}
                onClick={() => void loadRate()}
              >
                {rateBusy ? "Consultando…" : "Usar dólar oficial actual"}
              </button>
              <p role="status" className="mt-2 text-xs text-muted">
                {rateInfo}
              </p>
            </div>
          )}
          <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">
            El precio total corresponde a todos los pasajeros. Los importes de
            hospedaje son alternativas del paquete, no se suman al total. Al
            cambiar moneda se conservan los importes para que los revises.
          </p>
        </Section>
        <Section title="3. Transporte">
          <Field label="Modalidad">
            <select
              aria-label="Modalidad"
              className="admin-input"
              value={form.transport}
              onChange={(e) =>
                setForm((old) => ({
                  ...old,
                  transport: e.target.value as QuotationData["transport"],
                  legs:
                    e.target.value === "Clásico"
                      ? old.legs.slice(0, 1)
                      : old.legs,
                }))
              }
            >
              <option>Clásico</option>
              <option>Mixto</option>
            </select>
          </Field>
          <Field label="Recorrido">
            <select
              aria-label="Recorrido"
              className="admin-input"
              value={form.roundTrip ? "round" : "one"}
              onChange={(e) => change("roundTrip", e.target.value === "round")}
            >
              <option value="round">Ida y vuelta</option>
              <option value="one">Solo ida</option>
            </select>
          </Field>
          <p className="self-center text-sm text-muted">
            Cargá los tramos de ida en orden. La vuelta se completa
            automáticamente en sentido inverso.
          </p>
          {form.legs.map((l, i) => (
            <div
              key={l.key}
              className="rounded-lg border border-line bg-subtle p-4 sm:col-span-2 lg:col-span-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold">Tramo de ida {i + 1}</h4>
                {form.legs.length > 1 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      change(
                        "legs",
                        form.legs.filter((v) => v.key !== l.key),
                      )
                    }
                  >
                    Quitar tramo {i + 1}
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Transporte">
                  <select
                    aria-label={`Transporte tramo ${i + 1}`}
                    className="admin-input"
                    value={l.mode}
                    onChange={(e) =>
                      change(
                        "legs",
                        form.legs.map((v) =>
                          v.key === l.key
                            ? { ...v, mode: e.target.value as typeof l.mode }
                            : v,
                        ),
                      )
                    }
                  >
                    {transportTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Origen">
                  <input
                    aria-label={`Origen tramo ${i + 1}`}
                    className="admin-input"
                    required
                    maxLength={90}
                    value={l.from}
                    onChange={(e) =>
                      change(
                        "legs",
                        form.legs.map((v) =>
                          v.key === l.key ? { ...v, from: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Destino">
                  <input
                    aria-label={`Destino tramo ${i + 1}`}
                    className="admin-input"
                    required
                    maxLength={90}
                    value={l.to}
                    onChange={(e) =>
                      change(
                        "legs",
                        form.legs.map((v) =>
                          v.key === l.key ? { ...v, to: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
          {form.transport === "Mixto" && (
            <button
              type="button"
              className="btn-secondary justify-self-start"
              disabled={form.legs.length >= 6}
              onClick={() => change("legs", [...form.legs, leg()])}
            >
              Agregar tramo de ida
            </button>
          )}
          {form.roundTrip && (
            <div className="rounded-lg bg-tint p-4 sm:col-span-2 lg:col-span-3">
              <h4 className="font-bold">Vuelta automática</h4>
              <p
                data-testid="return-routes"
                className="mt-2 whitespace-pre-line text-sm"
              >
                {returnLegs(form.legs)
                  .map(
                    (l) =>
                      `${l.mode}: ${l.from || "Destino"} → ${l.to || "Origen"}`,
                  )
                  .join("\n")}
              </p>
            </div>
          )}
        </Section>
        <Section title="4. Hospedaje">
          {yesNo("lodging", "Incluir hospedaje")}
          {form.lodging && (
            <>
              <Field label="Cantidad de noches">
                <input
                  aria-label="Cantidad de noches"
                  className="admin-input"
                  type="number"
                  required
                  min={1}
                  max={999}
                  value={form.nights}
                  onChange={(e) => change("nights", Number(e.target.value))}
                />
              </Field>
              <p className="self-center text-sm text-muted">
                Calculadas con las fechas; podés ajustarlas si pasás noches en
                viaje.
              </p>
              {form.hotels.map((h, i) => (
                <div
                  key={h.key}
                  className="rounded-lg border border-line p-4 sm:col-span-2 lg:col-span-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-bold">Opción {i + 1}</h4>
                    {form.hotels.length > 1 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          change(
                            "hotels",
                            form.hotels.filter((v) => v.key !== h.key),
                          )
                        }
                      >
                        Quitar hospedaje {i + 1}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Nombre del hospedaje">
                      <input
                        aria-label={`Hospedaje ${i + 1}`}
                        className="admin-input"
                        required
                        maxLength={120}
                        value={h.name}
                        onChange={(e) =>
                          change(
                            "hotels",
                            form.hotels.map((v) =>
                              v.key === h.key
                                ? { ...v, name: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Pensión de esta opción">
                      <select
                        aria-label={`Pensión hospedaje ${i + 1}`}
                        className="admin-input"
                        value={h.board}
                        onChange={(e) =>
                          change(
                            "hotels",
                            form.hotels.map((v) =>
                              v.key === h.key
                                ? {
                                    ...v,
                                    board: e.target.value as typeof h.board,
                                  }
                                : v,
                            ),
                          )
                        }
                      >
                        {boards.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={`Precio total con esta opción (${form.currency})`}
                    >
                      <input
                        aria-label={`Precio hospedaje ${i + 1}`}
                        className="admin-input"
                        inputMode="decimal"
                        required
                        maxLength={16}
                        value={h.price}
                        onChange={(e) =>
                          change(
                            "hotels",
                            form.hotels.map((v) =>
                              v.key === h.key
                                ? { ...v, price: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary justify-self-start"
                disabled={form.hotels.length >= 8}
                onClick={() => change("hotels", [...form.hotels, hotel()])}
              >
                Agregar hospedaje
              </button>
            </>
          )}
        </Section>
        <Section title="5. Equipaje y servicios">
          <Field label="Carry-on (cantidad total)">
            <input
              aria-label="Carry-on (cantidad total)"
              className="admin-input"
              type="number"
              required
              min={0}
              max={999}
              value={form.carryOn}
              onChange={(e) => change("carryOn", Number(e.target.value))}
            />
          </Field>
          <Field label="Equipaje en bodega (cantidad total)">
            <input
              aria-label="Equipaje en bodega (cantidad total)"
              className="admin-input"
              type="number"
              required
              min={0}
              max={999}
              value={form.checkedBags}
              onChange={(e) => change("checkedBags", Number(e.target.value))}
            />
          </Field>
          {notes("baggageNotes", "Aclaraciones de equipaje", 400)}
          {yesNo("assistance", "Asistencia al viajero")}
          {form.assistance &&
            input("assistanceName", "Nombre de la asistencia", 120)}
          {form.assistance &&
            notes("assistanceNotes", "Detalle de asistencia", 400)}
          {yesNo("transfers", "Traslados")}
          {form.transfers &&
            notes("transferNotes", "Detalle de traslados", 400)}
          {yesNo("excursions", "Excursiones")}
          {form.excursions &&
            notes("excursionDetails", "Excursiones incluidas", 700)}
        </Section>
        <Section title="6. Aclaraciones">
          {notes("notes", "Aclaraciones y condiciones", 2000)}
        </Section>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-4 text-danger">
          {error}
        </p>
      )}
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted">Precio total de la cotización</p>
          <p className="text-2xl font-black">
            {form.currency}{" "}
            {/^[0-9]+([.,][0-9]{1,2})?$/.test(form.amount)
              ? decimalDisplay(form.amount.replace(",", "."))
              : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || uncertain || rateBusy}
            onClick={() => void preview()}
          >
            Vista previa A4
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || rateBusy}
          >
            {busy
              ? "Preparando PDF…"
              : uncertain
                ? "Reintentar guardado"
                : "Guardar cotización y PDF"}
          </button>
        </div>
        <p className="w-full text-xs text-muted">
          La vista previa no guarda ni consume un número. Las cotizaciones
          guardadas no suman ingresos; para registrar un cobro, emití un recibo.
        </p>
      </div>
    </form>
  );
}
