"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Field } from "@/components/site/shared";
import {
  calculateTotal,
  decimalDisplay,
  type Quote,
} from "@/features/receipts/domain";
import { ApiError, apiRequest } from "@/lib/api";
import {
  argentinaToday,
  categories,
  type ExpenseInput,
  type ExpenseRecord,
  expenseInputSchema,
  paymentMethods,
} from "./domain";

const blank = () => ({
  paidOn: argentinaToday(),
  payee: "",
  concept: "",
  category: "Otros" as ExpenseInput["category"],
  currency: "ARS" as "ARS" | "USD",
  amount: "",
  exchangeRate: "1",
  paymentMethod: "Transferencia" as ExpenseInput["paymentMethod"],
  reference: "",
  notes: "",
});
export function ExpenseForm({
  onSaved,
}: {
  onSaved: (expense: ExpenseRecord) => void;
}) {
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateInfo, setRateInfo] = useState("");
  const pending = useRef<ExpenseInput | null>(null);
  const inFlight = useRef(false);
  const quoteRequest = useRef<AbortController | null>(null);
  useEffect(() => () => quoteRequest.current?.abort(), []);
  function change<K extends keyof ReturnType<typeof blank>>(
    key: K,
    value: ReturnType<typeof blank>[K],
  ) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  function currency(value: "ARS" | "USD") {
    quoteRequest.current?.abort();
    setRateBusy(false);
    setRateInfo("");
    setForm((old) => ({
      ...old,
      currency: value,
      exchangeRate: value === "ARS" ? "1" : "",
    }));
  }
  async function loadQuote() {
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
        setRateInfo(
          "Cotización oficial de referencia actual. Si el pago es anterior, ingresá la cotización utilizada ese día.",
        );
      }
    } catch {
      if (!controller.signal.aborted)
        setRateInfo(
          "No se pudo obtener la cotización. Podés ingresarla manualmente.",
        );
    } finally {
      if (!controller.signal.aborted) setRateBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (!pending.current) {
      const parsed = expenseInputSchema.safeParse({
        ...form,
        requestId: crypto.randomUUID(),
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      pending.current = parsed.data;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const { expense } = await apiRequest<{ expense: ExpenseRecord }>(
        "/api/expenses",
        { method: "POST", body: JSON.stringify(pending.current) },
      );
      pending.current = null;
      setUncertain(false);
      setForm(blank());
      setRateInfo("");
      onSaved(expense);
    } catch (cause) {
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) pending.current = null;
      setError(
        ambiguous
          ? "No se pudo confirmar el guardado. Reintentá con el mismo envío para evitar duplicados."
          : cause.message,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  let total = "—";
  try {
    if (form.amount && form.exchangeRate)
      total = decimalDisplay(calculateTotal(form.amount, form.exchangeRate));
  } catch {}
  return (
    <form onSubmit={submit} className="surface-card p-5">
      <h2 className="mb-5 text-xl font-bold">Nuevo egreso</h2>
      <fieldset disabled={busy || uncertain} className="grid min-w-0 gap-4">
        <Field label="Fecha de pago">
          <input
            type="date"
            required
            className="admin-input"
            value={form.paidOn}
            onChange={(e) => change("paidOn", e.target.value)}
          />
        </Field>
        <Field label="Pagado a">
          <input
            required
            maxLength={120}
            className="admin-input"
            placeholder="Proveedor o destinatario"
            value={form.payee}
            onChange={(e) => change("payee", e.target.value)}
          />
        </Field>
        <Field label="Concepto">
          <input
            required
            maxLength={200}
            className="admin-input"
            placeholder="Ej.: seña del hotel"
            value={form.concept}
            onChange={(e) => change("concept", e.target.value)}
          />
        </Field>
        <Field label="Categoría">
          <select
            className="admin-input"
            value={form.category}
            aria-label="Categoría"
            onChange={(e) =>
              change("category", e.target.value as ExpenseInput["category"])
            }
          >
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select
              className="admin-input"
              value={form.currency}
              aria-label="Moneda"
              onChange={(e) => currency(e.target.value as "ARS" | "USD")}
            >
              <option>ARS</option>
              <option>USD</option>
            </select>
          </Field>
          <Field label="Importe">
            <input
              className="admin-input"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => change("amount", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Cotización en ARS">
          <input
            className="admin-input"
            required
            inputMode="decimal"
            readOnly={form.currency === "ARS"}
            value={form.exchangeRate}
            onChange={(e) => {
              quoteRequest.current?.abort();
              setRateBusy(false);
              change("exchangeRate", e.target.value);
            }}
          />
        </Field>
        {form.currency === "USD" && (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={rateBusy}
              onClick={() => void loadQuote()}
            >
              {rateBusy ? "Consultando…" : "Usar dólar oficial actual"}
            </button>
            <p className="text-xs text-muted">
              {rateInfo ||
                "Ingresá la cotización usada al pagar. El total histórico no cambia con el dólar de hoy."}
            </p>
          </>
        )}
        <Field label="Medio de pago">
          <select
            className="admin-input"
            value={form.paymentMethod}
            aria-label="Medio de pago"
            onChange={(e) =>
              change(
                "paymentMethod",
                e.target.value as ExpenseInput["paymentMethod"],
              )
            }
          >
            {paymentMethods.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Referencia / reserva (opcional)">
          <input
            className="admin-input"
            maxLength={120}
            value={form.reference}
            onChange={(e) => change("reference", e.target.value)}
          />
        </Field>
        <Field label="Notas (opcional)">
          <textarea
            className="admin-input"
            maxLength={1000}
            value={form.notes}
            onChange={(e) => change("notes", e.target.value)}
          />
        </Field>
      </fieldset>
      <p className="my-5 rounded-md bg-tint p-4 font-bold">
        Total ARS: $ {total}
      </p>
      {error && (
        <p role="alert" className="mb-4 text-danger">
          {error}
        </p>
      )}
      <button
        className="btn-primary w-full"
        disabled={busy || rateBusy}
        type="submit"
      >
        {busy
          ? "Guardando…"
          : uncertain
            ? "Reintentar guardado"
            : "Guardar egreso"}
      </button>
    </form>
  );
}
