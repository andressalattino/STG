"use client";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  cloneElement,
  type FormEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { decimalDisplay, type Quote } from "@/features/receipts/domain";
import { ApiError, apiRequest, authenticatedFetch } from "@/lib/api";
import {
  type ContractData,
  type ContractInput,
  type ContractRecord,
  contractDraftSchema,
  contractInputSchema,
  contractLabel,
  contractTotals,
  mealTypes,
  normalizeContractData,
  roomTypes,
} from "./domain";

const id = () => crypto.randomUUID();
const passenger = (): ContractData["passengers"][number] => ({
  id: id(),
  name: "",
  dni: "",
  birthDate: "",
  phone: "",
});
const room = (): ContractData["hotels"][number]["rooms"][number] => ({
  id: id(),
  type: "Doble matrimonial",
  quantity: 1,
});
const hotel = (): ContractData["hotels"][number] => ({
  id: id(),
  name: "",
  stars: 3,
  checkIn: "",
  checkOut: "",
  rooms: [room()],
  meals: [],
});
function blank(): ContractData {
  return {
    destination: "",
    reservationNumber: "",
    departure: { date: "", time: "", place: "" },
    return: { date: "", time: "", place: "" },
    hotels: [],
    excursions: [],
    transport: [],
    passengers: [passenger()],
    currency: "ARS",
    unitPrice: "",
    totalOverride: null,
    deposit: "0",
    exchangeRate: "1",
    rateSource: "ars",
    quoteUpdatedAt: null,
    notes: "",
  };
}
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const controlId = useId();
  return (
    <div className="receipt-field">
      <label htmlFor={controlId}>{label}</label>
      {cloneElement(children, { id: controlId })}
    </div>
  );
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary text-danger"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 size={16} aria-hidden="true" />
      Quitar
    </button>
  );
}
function Add({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-secondary w-fit"
      disabled={disabled}
      onClick={onClick}
    >
      <Plus size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
export function ContractForm({
  source,
  onSaved,
  onCancelVersion,
}: {
  source?: ContractRecord;
  onSaved: (contract: ContractRecord) => void;
  onCancelVersion: () => void;
}) {
  const [form, setForm] = useState<ContractData>(() =>
    source ? structuredClone(normalizeContractData(source.data)) : blank(),
  );
  const [busy, setBusy] = useState(false),
    [previewBusy, setPreviewBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState("");
  const [rateBusy, setRateBusy] = useState(false),
    [rateError, setRateError] = useState("");
  const requestId = useRef(""),
    pending = useRef<ContractInput | null>(null),
    inFlight = useRef(false),
    previewUrl = useRef("");
  const rateController = useRef<AbortController | null>(null),
    rateSequence = useRef(0);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    return () => {
      rateController.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  function update<K extends keyof ContractData>(
    key: K,
    value: ContractData[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function updateHotel(
    hotelId: string,
    patch: Partial<ContractData["hotels"][number]>,
  ) {
    setForm((current) => ({
      ...current,
      hotels: current.hotels.map((h) =>
        h.id === hotelId ? { ...h, ...patch } : h,
      ),
    }));
  }
  function stopRate() {
    rateController.current?.abort();
    ++rateSequence.current;
    setRateBusy(false);
  }
  async function loadQuote() {
    stopRate();
    const controller = new AbortController();
    rateController.current = controller;
    const sequence = rateSequence.current;
    setRateBusy(true);
    setRateError("");
    try {
      const quote = await apiRequest<Quote>("/api/exchange-rate", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || sequence !== rateSequence.current)
        return;
      setForm((current) =>
        current.currency === "USD"
          ? {
              ...current,
              exchangeRate: quote.value,
              rateSource: "dolarapi-oficial-venta",
              quoteUpdatedAt: quote.updatedAt,
            }
          : current,
      );
    } catch (e) {
      if (!controller.signal.aborted && sequence === rateSequence.current)
        setRateError(
          e instanceof Error ? e.message : "Ingresá la cotización manualmente.",
        );
    } finally {
      if (sequence === rateSequence.current) setRateBusy(false);
    }
  }
  function currencyChange(currency: ContractData["currency"]) {
    stopRate();
    setRateError("");
    setForm((current) => ({
      ...current,
      currency,
      exchangeRate: currency === "ARS" ? "1" : "",
      rateSource: currency === "ARS" ? "ars" : "manual",
      quoteUpdatedAt: null,
    }));
    if (currency === "USD") void loadQuote();
  }
  async function preview() {
    const parsed = contractDraftSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos.");
      return;
    }
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setPreviewBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/contracts/preview", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(await response.blob());
      if (!tab)
        throw new Error(
          "Permití ventanas emergentes para abrir la vista previa.",
        );
      tab.location.href = previewUrl.current;
    } catch (e) {
      tab?.close();
      setError(
        e instanceof Error ? e.message : "No se pudo generar la vista previa.",
      );
    } finally {
      setPreviewBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = contractInputSchema.safeParse(
      pending.current ?? {
        requestId: requestId.current,
        previousId: source?.id ?? null,
        data: form,
      },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    pending.current = parsed.data;
    try {
      const result = await apiRequest<{ contract: ContractRecord }>(
        "/api/contracts",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      pending.current = null;
      setUncertain(false);
      requestId.current = crypto.randomUUID();
      onSaved(result.contract);
    } catch (e) {
      const ambiguous = !(e instanceof ApiError) || e.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) pending.current = null;
      setError(
        ambiguous
          ? "No pudimos confirmar la respuesta. Reintentá el mismo envío: recuperaremos el contrato si ya se guardó, sin duplicarlo."
          : e.message,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  let totals: ReturnType<typeof contractTotals> | null = null;
  let automaticTotal = "";
  try {
    if (form.unitPrice)
      automaticTotal = contractTotals({
        ...form,
        totalOverride: null,
        deposit: "0",
        exchangeRate: "1",
      }).total;
  } catch {
    /* Keep incomplete prices editable. */
  }
  try {
    if (form.unitPrice && form.exchangeRate && form.deposit)
      totals = contractTotals(form);
  } catch {
    /* Incomplete inputs have no calculated total. */
  }
  const blocked = busy || uncertain || previewBusy;
  return (
    <form onSubmit={submit} className="surface-card overflow-hidden">
      <div className="border-b border-line p-5 sm:p-6">
        <h2 className="text-xl font-black">
          {source
            ? `Nueva versión de ${contractLabel(source)}`
            : "Nuevo contrato"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          La fecha y el número se asignan al emitir. Máximo 6 pasajeros y 3
          hoteles, siempre en una sola hoja A4.
        </p>
        {source && (
          <p className="mt-2 text-sm text-muted">
            La versión anterior y su PDF se conservan.
          </p>
        )}
      </div>
      <fieldset disabled={blocked} className="min-w-0 space-y-7 p-5 sm:p-6">
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-3 text-lg font-black">Viaje</legend>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Tour / destino">
              <input
                required
                maxLength={160}
                className="admin-input"
                value={form.destination}
                onChange={(e) => update("destination", e.target.value)}
              />
            </Field>
            <Field label="N.º de reserva (manual)">
              <input
                maxLength={60}
                className="admin-input"
                value={form.reservationNumber}
                onChange={(e) => update("reservationNumber", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ["departure", "Salida"],
                ["return", "Regreso"],
              ] as const
            ).map(([key, label]) => (
              <fieldset
                key={key}
                className="min-w-0 space-y-3 rounded-lg border border-line p-4"
              >
                <legend className="px-1 font-bold">{label}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`Fecha de ${label.toLowerCase()}`}>
                    <input
                      required
                      type="date"
                      className="admin-input"
                      value={form[key].date}
                      onChange={(e) =>
                        update(key, { ...form[key], date: e.target.value })
                      }
                    />
                  </Field>
                  <Field label={`Hora de ${label.toLowerCase()} (opcional)`}>
                    <input
                      type="time"
                      className="admin-input"
                      value={form[key].time}
                      onChange={(e) =>
                        update(key, { ...form[key], time: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label={`Lugar de ${label.toLowerCase()}`}>
                  <input
                    required
                    maxLength={180}
                    className="admin-input"
                    placeholder="Ciudad y punto de encuentro"
                    value={form[key].place}
                    onChange={(e) =>
                      update(key, { ...form[key], place: e.target.value })
                    }
                  />
                </Field>
              </fieldset>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-3 text-lg font-black">
            Alojamiento y habitaciones
          </legend>
          {form.hotels.length === 0 && (
            <p className="text-sm text-muted">
              Sin alojamiento incluido. Agregá los hoteles cuando corresponda.
            </p>
          )}
          {form.hotels.map((h, hi) => (
            <fieldset
              key={h.id}
              className="min-w-0 space-y-4 rounded-xl border border-line bg-subtle/40 p-4"
              aria-label={`Hotel ${hi + 1}`}
            >
              <legend className="px-1 font-bold">Hotel {hi + 1}</legend>
              <div className="flex justify-end">
                <Remove
                  label={`Quitar hotel ${hi + 1}`}
                  onClick={() =>
                    update(
                      "hotels",
                      form.hotels.filter((item) => item.id !== h.id),
                    )
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del hotel">
                  <input
                    required
                    maxLength={120}
                    className="admin-input"
                    value={h.name}
                    onChange={(e) =>
                      updateHotel(h.id, { name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Estrellas">
                  <select
                    className="admin-input"
                    value={h.stars}
                    onChange={(e) =>
                      updateHotel(h.id, { stars: Number(e.target.value) })
                    }
                  >
                    {[0, 1, 2, 3, 4, 5].map((stars) => (
                      <option key={stars} value={stars}>
                        {stars ? `${stars} estrellas` : "Sin categoría"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ingreso al hotel">
                  <input
                    required
                    type="date"
                    className="admin-input"
                    value={h.checkIn}
                    onChange={(e) =>
                      updateHotel(h.id, { checkIn: e.target.value })
                    }
                  />
                </Field>
                <Field label="Egreso del hotel">
                  <input
                    required
                    type="date"
                    className="admin-input"
                    value={h.checkOut}
                    min={h.checkIn || undefined}
                    onChange={(e) =>
                      updateHotel(h.id, { checkOut: e.target.value })
                    }
                  />
                </Field>
              </div>
              <fieldset className="min-w-0 space-y-3">
                <legend className="mb-2 font-bold">Habitaciones</legend>
                {h.rooms.map((r, ri) => (
                  <div
                    key={r.id}
                    className="grid items-end gap-3 sm:grid-cols-[1fr_110px_auto]"
                  >
                    <Field label={`Tipo de habitación ${ri + 1}`}>
                      <select
                        className="admin-input"
                        value={r.type}
                        onChange={(e) =>
                          updateHotel(h.id, {
                            rooms: h.rooms.map((item) =>
                              item.id === r.id
                                ? {
                                    ...item,
                                    type: e.target.value as typeof r.type,
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        {roomTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cantidad">
                      <input
                        required
                        type="number"
                        min={1}
                        max={6}
                        className="admin-input"
                        value={r.quantity}
                        onChange={(e) =>
                          updateHotel(h.id, {
                            rooms: h.rooms.map((item) =>
                              item.id === r.id
                                ? { ...item, quantity: Number(e.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Remove
                      label={`Quitar habitación ${ri + 1} del hotel ${hi + 1}`}
                      onClick={() =>
                        updateHotel(h.id, {
                          rooms: h.rooms.filter((item) => item.id !== r.id),
                        })
                      }
                    />
                  </div>
                ))}
                <Add
                  label="Agregar habitación"
                  disabled={h.rooms.length >= 6}
                  onClick={() =>
                    updateHotel(h.id, { rooms: [...h.rooms, room()] })
                  }
                />
              </fieldset>
              <Field label="Régimen de comidas">
                <select
                  className="admin-input"
                  value={h.meals[0] ?? ""}
                  onChange={(e) =>
                    updateHotel(h.id, {
                      meals: e.target.value
                        ? [e.target.value as (typeof mealTypes)[number]]
                        : [],
                    })
                  }
                >
                  <option value="">Sin comidas incluidas</option>
                  {mealTypes.map((meal) => (
                    <option key={meal}>{meal}</option>
                  ))}
                </select>
              </Field>
            </fieldset>
          ))}
          <Add
            label="Agregar hotel"
            disabled={form.hotels.length >= 3}
            onClick={() => update("hotels", [...form.hotels, hotel()])}
          />
        </fieldset>
        <div className="grid gap-6 lg:grid-cols-2">
          {([["excursions", "Excursiones", "excursión"]] as const).map(
            ([key, title, singular]) => (
              <fieldset key={key} className="min-w-0 space-y-3">
                <legend className="mb-3 text-lg font-black">{title}</legend>
                {!form[key].length && (
                  <p className="text-sm text-muted">No incluidos.</p>
                )}
                {form[key].map((item, i) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-lg border border-line p-3"
                  >
                    <Field label={`Excursión ${i + 1}`}>
                      <textarea
                        required
                        rows={2}
                        maxLength={600}
                        className="admin-input"
                        placeholder="Nombre, fecha y detalle de lo incluido"
                        value={item.description}
                        onChange={(e) =>
                          update(
                            key,
                            form[key].map((row) =>
                              row.id === item.id
                                ? { ...row, description: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Remove
                      label={`Quitar ${singular} ${i + 1}`}
                      onClick={() =>
                        update(
                          key,
                          form[key].filter((row) => row.id !== item.id),
                        )
                      }
                    />
                  </div>
                ))}
                <Add
                  label={`Agregar ${singular}`}
                  disabled={form[key].length >= 20}
                  onClick={() =>
                    update(key, [...form[key], { id: id(), description: "" }])
                  }
                />
              </fieldset>
            ),
          )}
          <fieldset className="min-w-0 space-y-3">
            <legend className="mb-3 text-lg font-black">Transporte</legend>
            {!form.transport.length && (
              <p className="text-sm text-muted">No incluido.</p>
            )}
            {form.transport.map((item, i) => (
              <fieldset
                key={item.id}
                aria-label={`Transporte ${i + 1}`}
                className="min-w-0 space-y-3 rounded-lg border border-line p-3"
              >
                <legend className="px-1 font-bold">Transporte {i + 1}</legend>
                <Field label="Tipo de transporte">
                  <select
                    className="admin-input"
                    value={item.type}
                    onChange={(e) =>
                      update(
                        "transport",
                        form.transport.map((t) =>
                          t.id === item.id
                            ? {
                                ...t,
                                type: e.target.value as "Aéreo" | "Bus",
                                seat: e.target.value === "Bus" ? "Cama" : null,
                                description: "",
                              }
                            : t,
                        ),
                      )
                    }
                  >
                    <option>Aéreo</option>
                    <option>Bus</option>
                  </select>
                </Field>
                {item.type === "Bus" && (
                  <Field label="Servicio de bus">
                    <select
                      className="admin-input"
                      value={item.seat ?? ""}
                      onChange={(e) =>
                        update(
                          "transport",
                          form.transport.map((t) =>
                            t.id === item.id
                              ? {
                                  ...t,
                                  seat: e.target.value as "Cama" | "Semicama",
                                }
                              : t,
                          ),
                        )
                      }
                    >
                      <option>Cama</option>
                      <option>Semicama</option>
                    </select>
                  </Field>
                )}
                <Field
                  label={
                    item.type === "Aéreo"
                      ? "Especificaciones del aéreo"
                      : "Empresa / recorrido (opcional)"
                  }
                >
                  <textarea
                    required={item.type === "Aéreo"}
                    rows={2}
                    maxLength={600}
                    className="admin-input"
                    placeholder={
                      item.type === "Aéreo"
                        ? "Aerolínea, vuelo, recorrido, fecha y horario"
                        : "Empresa, recorrido y detalles del viaje"
                    }
                    value={item.description}
                    onChange={(e) =>
                      update(
                        "transport",
                        form.transport.map((t) =>
                          t.id === item.id
                            ? { ...t, description: e.target.value }
                            : t,
                        ),
                      )
                    }
                  />
                </Field>
                <Remove
                  label={`Quitar transporte ${i + 1}`}
                  onClick={() =>
                    update(
                      "transport",
                      form.transport.filter((t) => t.id !== item.id),
                    )
                  }
                />
              </fieldset>
            ))}
            <Add
              label="Agregar transporte"
              disabled={form.transport.length >= 20}
              onClick={() =>
                update("transport", [
                  ...form.transport,
                  { id: id(), type: "Bus", seat: "Cama", description: "" },
                ])
              }
            />
          </fieldset>
        </div>
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-3 text-lg font-black">Pasajeros</legend>
          {form.passengers.map((p, i) => (
            <fieldset
              key={p.id}
              aria-label={`Pasajero ${i + 1}`}
              className="min-w-0 space-y-3 rounded-xl border border-line p-4"
            >
              <legend className="px-1 font-bold">Pasajero {i + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre y apellido">
                  <input
                    required
                    maxLength={120}
                    className="admin-input"
                    value={p.name}
                    onChange={(e) =>
                      update(
                        "passengers",
                        form.passengers.map((row) =>
                          row.id === p.id
                            ? { ...row, name: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="DNI">
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    className="admin-input"
                    placeholder="Sin puntos"
                    value={p.dni}
                    onChange={(e) =>
                      update(
                        "passengers",
                        form.passengers.map((row) =>
                          row.id === p.id
                            ? { ...row, dni: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Fecha de nacimiento">
                  <input
                    required
                    type="date"
                    className="admin-input"
                    value={p.birthDate}
                    onChange={(e) =>
                      update(
                        "passengers",
                        form.passengers.map((row) =>
                          row.id === p.id
                            ? { ...row, birthDate: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Teléfono (opcional)">
                  <input
                    type="tel"
                    maxLength={40}
                    className="admin-input"
                    value={p.phone}
                    onChange={(e) =>
                      update(
                        "passengers",
                        form.passengers.map((row) =>
                          row.id === p.id
                            ? { ...row, phone: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <Remove
                label={`Quitar pasajero ${i + 1}`}
                onClick={() =>
                  update(
                    "passengers",
                    form.passengers.filter((row) => row.id !== p.id),
                  )
                }
              />
            </fieldset>
          ))}
          <Add
            label="Agregar pasajero"
            disabled={form.passengers.length >= 6}
            onClick={() =>
              update("passengers", [...form.passengers, passenger()])
            }
          />
        </fieldset>
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-3 text-lg font-black">Precio y reserva</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Moneda">
              <select
                className="admin-input"
                value={form.currency}
                onChange={(e) =>
                  currencyChange(e.target.value as ContractData["currency"])
                }
              >
                <option value="ARS">Pesos argentinos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </Field>
            <Field label="Valor del pasaje por persona">
              <input
                required
                inputMode="decimal"
                className="admin-input"
                value={form.unitPrice}
                onChange={(e) => update("unitPrice", e.target.value)}
              />
            </Field>
            <Field label={`Seña (${form.currency})`}>
              <input
                required
                inputMode="decimal"
                className="admin-input"
                value={form.deposit}
                onChange={(e) => update("deposit", e.target.value)}
              />
            </Field>
            <Field label="Efectivo (total)">
              <input
                required
                inputMode="decimal"
                className="admin-input"
                data-testid="contract-total-input"
                value={form.totalOverride ?? automaticTotal}
                onChange={(e) => update("totalOverride", e.target.value)}
              />
            </Field>
          </div>
          {form.totalOverride !== null && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">
                Total modificado. Cálculo automático: {form.currency}{" "}
                {automaticTotal ? decimalDisplay(automaticTotal) : "—"}.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => update("totalOverride", null)}
              >
                Volver al cálculo automático
              </button>
            </div>
          )}
          {form.currency === "USD" && (
            <div className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Cotización USD a ARS">
                  <input
                    required
                    inputMode="decimal"
                    className="admin-input"
                    value={form.exchangeRate}
                    onChange={(e) => {
                      stopRate();
                      setForm((current) => ({
                        ...current,
                        exchangeRate: e.target.value,
                        rateSource: "manual",
                        quoteUpdatedAt: null,
                      }));
                    }}
                  />
                </Field>
                <button
                  type="button"
                  disabled={rateBusy}
                  className="btn-secondary"
                  onClick={() => void loadQuote()}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  {rateBusy ? "Consultando…" : "Consultar dólar oficial"}
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">
                {form.rateSource === "manual"
                  ? "Cotización manual."
                  : "Cotización oficial de venta."}
                {form.quoteUpdatedAt &&
                  ` Actualizada: ${new Date(form.quoteUpdatedAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.`}
              </p>
              {rateError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {rateError}
                </p>
              )}
            </div>
          )}
          <div
            aria-live="polite"
            className="grid gap-4 rounded-xl border border-line bg-subtle p-4 sm:grid-cols-3"
          >
            <div>
              <p className="text-sm text-muted">
                Efectivo (total de {form.passengers.length} pasajeros)
              </p>
              <p
                className="mt-1 text-xl font-black"
                data-testid="contract-total"
              >
                {form.currency} {totals ? decimalDisplay(totals.total) : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Seña</p>
              <p className="mt-1 text-xl font-black">
                {form.currency}{" "}
                {totals ? decimalDisplay(form.deposit.replace(",", ".")) : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">Resto</p>
              <p
                className="mt-1 text-xl font-black"
                data-testid="contract-remaining"
              >
                {form.currency}{" "}
                {totals ? decimalDisplay(totals.remaining) : "—"}
              </p>
            </div>
            {form.currency === "USD" && totals && (
              <p className="text-sm text-muted sm:col-span-3">
                Equivalente total: ARS {decimalDisplay(totals.totalArs)}
              </p>
            )}
          </div>
          <p className="text-sm text-muted">
            La seña queda indicada en este contrato. Para registrar el cobro,
            emití un recibo.
          </p>
          <Field label="Observaciones">
            <textarea
              rows={4}
              maxLength={3000}
              className="admin-input"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
        </fieldset>
      </fieldset>
      <div className="space-y-4 border-t border-line p-5 sm:p-6">
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={blocked}
            onClick={() => void preview()}
          >
            {previewBusy ? "Preparando PDF…" : "Vista previa A4"}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || previewBusy}
          >
            {busy
              ? "Guardando…"
              : uncertain
                ? "Reintentar el mismo envío"
                : source
                  ? "Guardar nueva versión y PDF"
                  : "Guardar contrato y PDF"}
          </button>
          {source && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || uncertain}
              onClick={onCancelVersion}
            >
              Cancelar nueva versión
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
