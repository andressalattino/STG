"use client";
import { FilePlus2, RefreshCw, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import {
  calculateTotal,
  decimalDisplay,
  issuedDate,
  issuedTime,
  type Quote,
  type ReceiptInput,
  type ReceiptRecord,
  receiptInputSchema,
} from "./domain";

const blank = {
  client: "",
  currency: "ARS" as "ARS" | "USD",
  amount: "",
  exchangeRate: "1",
  reservation: "",
  passengers: "1",
  travelDate: "",
  destination: "",
  paymentMethod: "Transferencia" as ReceiptInput["paymentMethod"],
};
export function ReceiptForm({
  enabled,
  onIssued,
}: {
  enabled: boolean;
  onIssued: (receipt: ReceiptRecord) => void;
}) {
  const [form, setForm] = useState(blank);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [manualRate, setManualRate] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef("");
  const inFlight = useRef(false);
  const pendingInput = useRef<ReceiptInput | null>(null);
  const quoteController = useRef<AbortController | null>(null);
  const quoteSequence = useRef(0);

  useEffect(() => {
    requestId.current = crypto.randomUUID();
    return () => quoteController.current?.abort();
  }, []);

  async function loadQuote() {
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    const sequence = ++quoteSequence.current;
    setRateBusy(true);
    setRateError("");
    try {
      const current = await apiRequest<Quote>("/api/exchange-rate", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || sequence !== quoteSequence.current)
        return;
      setQuote(current);
      setManualRate(false);
      setForm((value) =>
        value.currency === "USD"
          ? { ...value, exchangeRate: current.value }
          : value,
      );
    } catch (failure) {
      if (controller.signal.aborted || sequence !== quoteSequence.current)
        return;
      setRateError(
        failure instanceof Error
          ? failure.message
          : "Ingresá la cotización manualmente.",
      );
    } finally {
      if (sequence === quoteSequence.current) setRateBusy(false);
    }
  }
  function changeCurrency(currency: "ARS" | "USD") {
    quoteController.current?.abort();
    quoteSequence.current += 1;
    setQuote(null);
    setRateError("");
    setRateBusy(false);
    setManualRate(false);
    setForm((value) => ({
      ...value,
      currency,
      exchangeRate: currency === "ARS" ? "1" : "",
    }));
    if (currency === "USD") void loadQuote();
  }
  function changeManualRate(value: string) {
    quoteController.current?.abort();
    quoteSequence.current += 1;
    setRateBusy(false);
    setManualRate(true);
    setForm((current) => ({ ...current, exchangeRate: value }));
  }
  let total = "0,00";
  try {
    if (form.amount && form.exchangeRate)
      total = decimalDisplay(calculateTotal(form.amount, form.exchangeRate));
  } catch {
    /* Incomplete input has no preview total. */
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !enabled) return;
    const parsed = receiptInputSchema.safeParse(
      pendingInput.current ?? {
        ...form,
        requestId: requestId.current,
        rateSource:
          form.currency === "ARS"
            ? "ars"
            : quote && !manualRate
              ? "dolarapi-oficial-venta"
              : "manual",
        quoteUpdatedAt: quote && !manualRate ? quote.updatedAt : null,
      },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los datos.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    pendingInput.current = parsed.data;
    try {
      const result = await apiRequest<{ receipt: ReceiptRecord }>(
        "/api/receipts",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      pendingInput.current = null;
      requestId.current = crypto.randomUUID();
      setForm(blank);
      setQuote(null);
      setManualRate(false);
      setRateError("");
      setUncertain(false);
      onIssued(result.receipt);
    } catch (failure) {
      const ambiguous = !(failure instanceof ApiError) || failure.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) pendingInput.current = null;
      setError(
        ambiguous
          ? "No pudimos confirmar la respuesta. Reintentá este mismo envío: si ya se guardó, recuperaremos el recibo sin duplicarlo."
          : failure instanceof Error
            ? failure.message
            : "No se pudo emitir el recibo.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="surface-card overflow-hidden">
      <div className="border-b border-line p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-stg-yellow p-2 text-ink">
            <FilePlus2 size={22} />
          </span>
          <div>
            <h2 className="text-xl font-bold">Nuevo recibo</h2>
            <p className="mt-1 text-sm text-muted">
              Completá los datos del pago y del viaje.
            </p>
          </div>
        </div>
      </div>
      <fieldset
        disabled={!enabled || busy || uncertain}
        className="grid gap-5 p-5 sm:p-6"
      >
        <label className="receipt-field">
          Cliente
          <input
            name="client"
            className="admin-input"
            maxLength={80}
            autoComplete="name"
            required
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
            placeholder="Nombre y apellido o razón social"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="receipt-field">
            Moneda
            <select
              className="admin-input"
              value={form.currency}
              onChange={(e) => changeCurrency(e.target.value as "ARS" | "USD")}
            >
              <option value="ARS">ARS · Pesos</option>
              <option value="USD">USD · Dólares</option>
            </select>
          </label>
          <label className="receipt-field">
            Importe recibido
            <input
              name="amount"
              className="admin-input"
              inputMode="decimal"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Ej. 1500,50"
            />
          </label>
        </div>
        <div className="rounded-lg border border-line bg-subtle p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="receipt-field flex-1">
              Cotización en ARS
              <input
                aria-describedby="rate-help"
                className="admin-input"
                inputMode="decimal"
                required
                readOnly={form.currency === "ARS"}
                value={form.exchangeRate}
                onChange={(e) => changeManualRate(e.target.value)}
                placeholder={
                  rateBusy ? "Consultando…" : "Ingresá la cotización"
                }
              />
            </label>
            {form.currency === "USD" && (
              <button
                type="button"
                onClick={() => void loadQuote()}
                disabled={rateBusy}
                className="btn-ghost mt-6 p-3"
                aria-label="Actualizar dólar oficial"
              >
                <RefreshCw
                  size={18}
                  className={rateBusy ? "animate-spin" : ""}
                />
              </button>
            )}
          </div>
          <p id="rate-help" className="mt-3 text-xs leading-5 text-muted">
            {form.currency === "ARS"
              ? "Para pesos argentinos, la cotización siempre es 1."
              : quote
                ? `Dólar oficial · venta · DolarAPI. Actualizado ${issuedDate(quote.updatedAt)} a las ${issuedTime(quote.updatedAt)}. ${manualRate ? "Usando tu cotización manual." : "Podés modificar este valor."}`
                : "Dólar oficial, valor de venta. Podés ingresar o corregir la cotización manualmente."}
          </p>
          {quote &&
            Date.now() - new Date(quote.updatedAt).getTime() > 72 * 3600000 && (
              <p className="mt-2 text-sm font-semibold text-danger">
                La cotización tiene más de 72 horas. Verificá el valor antes de
                emitir.
              </p>
            )}
          {rateError && (
            <p role="status" className="mt-2 text-sm text-danger">
              {rateError}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="receipt-field">
            N.º de reserva
            <input
              className="admin-input"
              required
              maxLength={40}
              value={form.reservation}
              onChange={(e) =>
                setForm({ ...form, reservation: e.target.value })
              }
              placeholder="Ej. 00125"
            />
          </label>
          <label className="receipt-field">
            Cantidad de pasajeros
            <input
              className="admin-input"
              type="number"
              min={1}
              max={9999}
              step={1}
              required
              value={form.passengers}
              onChange={(e) => setForm({ ...form, passengers: e.target.value })}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="receipt-field">
            Fecha de viaje
            <input
              className="admin-input"
              type="date"
              min="1900-01-01"
              max="2199-12-31"
              required
              value={form.travelDate}
              onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
            />
          </label>
          <label className="receipt-field">
            Forma de pago
            <select
              className="admin-input"
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentMethod: e.target
                    .value as ReceiptInput["paymentMethod"],
                })
              }
            >
              {["Transferencia", "Efectivo", "Tarjeta", "Otro"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="receipt-field">
          Destino / viaje
          <input
            className="admin-input"
            required
            maxLength={160}
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder="Ej. Bariloche · salida grupal"
          />
        </label>
      </fieldset>
      <div className="border-t border-line bg-subtle p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-muted">Total en pesos</span>
          <strong className="text-2xl tabular-nums">ARS {total}</strong>
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} />
          El servidor verifica el cálculo antes de emitir.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!enabled || busy || rateBusy}
          className="btn-primary mt-5 w-full"
        >
          <FilePlus2 size={18} />
          {busy
            ? "Generando recibo y PDF…"
            : uncertain
              ? "Reintentar el mismo envío"
              : "Generar recibo"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Se guardará un comprobante A4 con dos copias.
        </p>
      </div>
    </form>
  );
}
