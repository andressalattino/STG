"use client";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  LogOut,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  decimalDisplay,
  issuedDate,
  issuedTime,
  type ReceiptRecord,
  receiptNumber,
  travelDateDisplay,
} from "./domain";
import { ReceiptActions } from "./ReceiptActions";
import { ReceiptForm } from "./ReceiptForm";

type History = {
  receipts: ReceiptRecord[];
  total: number;
  page: number;
  pageSize: number;
  numbering: { nextNumber: number; initialized: boolean } | null;
};
export function ReceiptWorkspace({ onLogout }: { onLogout: () => void }) {
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [issued, setIssued] = useState<ReceiptRecord | null>(null);
  const [firstNumber, setFirstNumber] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads the server history after issuing or retrying.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), q });
    if (currency) params.set("currency", currency);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    void apiRequest<History>(`/api/receipts?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setHistory(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "No se pudo cargar el historial.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, q, currency, from, to, revision]);
  async function initialize(event: FormEvent) {
    event.preventDefault();
    if (savingNumber) return;
    setSavingNumber(true);
    setError("");
    try {
      await apiRequest("/api/receipts/numbering", {
        method: "POST",
        body: JSON.stringify({ start: Number(firstNumber) }),
      });
      refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo configurar la numeración.",
      );
    } finally {
      setSavingNumber(false);
    }
  }
  function afterIssued(receipt: ReceiptRecord) {
    setIssued(receipt);
    setPage(1);
    setQ("");
    setDraftQuery("");
    setCurrency("");
    setFrom("");
    setTo("");
    refresh();
  }
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted"
        >
          <ArrowLeft size={17} />
          Volver a administración
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="btn-ghost px-3 py-2"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Administración / Recibos</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Recibos de viaje
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Registrá pagos, emití el comprobante y encontrá todos tus recibos en
            un solo lugar.
          </p>
        </div>
        <div className="surface-card flex items-center gap-3 px-5 py-3">
          <FileText className="text-stg-blue" size={22} />
          <div>
            <p className="text-xs text-muted">Próximo número</p>
            <p className="text-xl font-bold tabular-nums">
              {history?.numbering?.initialized
                ? receiptNumber(history.numbering.nextNumber)
                : "Por configurar"}
            </p>
          </div>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger"
        >
          <p>{error}</p>
          <button type="button" className="btn-ghost" onClick={refresh}>
            Reintentar
          </button>
        </div>
      )}
      {history && !history.numbering?.initialized && (
        <form
          onSubmit={initialize}
          className="surface-card mb-6 grid gap-4 border-stg-blue p-5 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        >
          <div>
            <h2 className="font-bold">Configurar la primera numeración</h2>
            <p className="mt-2 text-sm text-muted">
              El sistema nuevo comienza en 000001. Esta configuración se hace
              una sola vez y no modifica recibos ya emitidos.
            </p>
          </div>
          <label className="receipt-field">
            Primer número
            <input
              className="admin-input"
              type="number"
              min={1}
              max={999999}
              required
              value={firstNumber}
              onChange={(e) => setFirstNumber(e.target.value)}
              placeholder="1"
            />
          </label>
          <button type="submit" disabled={savingNumber} className="btn-primary">
            Confirmar numeración
          </button>
        </form>
      )}
      {issued && (
        <div
          role="status"
          className="surface-card mb-6 border-emerald-600/40 p-5"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" />
            <div>
              <h2 className="font-bold">
                Recibo {receiptNumber(issued.number)} emitido correctamente
              </h2>
              <p className="mt-1 text-sm text-muted">
                {issued.client} · Total ARS {decimalDisplay(issued.totalArs)}
              </p>
            </div>
          </div>
          <ReceiptActions key={issued.id} receipt={issued} prominent />
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
        <ReceiptForm
          enabled={Boolean(history?.numbering?.initialized) && !error}
          onIssued={afterIssued}
        />
        <div className="surface-card min-w-0 overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Historial de recibos</h2>
                <p className="mt-1 text-sm text-muted">
                  {history
                    ? `${history.total} comprobante${history.total === 1 ? "" : "s"}`
                    : "Cargando comprobantes…"}{" "}
                  · Horario de Argentina
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost p-3"
                onClick={refresh}
                disabled={loading}
                aria-label="Actualizar historial"
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(draftQuery);
              }}
            >
              <label className="sr-only" htmlFor="receipt-search">
                Buscar recibos
              </label>
              <input
                id="receipt-search"
                className="admin-input"
                maxLength={100}
                placeholder="Cliente, reserva, destino o número…"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
              />
              <button className="btn-ghost" type="submit" aria-label="Buscar">
                <Search size={18} />
              </button>
            </form>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="receipt-field">
                Moneda
                <select
                  className="admin-input"
                  value={currency}
                  onChange={(e) => {
                    setPage(1);
                    setCurrency(e.target.value);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="receipt-field">
                Emitidos desde
                <input
                  className="admin-input"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    setPage(1);
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label className="receipt-field">
                Hasta
                <input
                  className="admin-input"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setPage(1);
                    setTo(e.target.value);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="receipt-table">
              <caption className="sr-only">
                Historial de recibos emitidos con acceso a sus comprobantes PDF
              </caption>
              <thead>
                <tr>
                  {[
                    "N.º recibo",
                    "Fecha",
                    "Hora",
                    "Cliente",
                    "Reserva",
                    "Pasajeros",
                    "Fecha de viaje",
                    "Destino / viaje",
                    "Moneda",
                    "Importe",
                    "Cotización",
                    "Total ARS",
                    "PDF",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history?.receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="font-bold text-stg-blue">
                      {receiptNumber(receipt.number)}
                    </td>
                    <td>{issuedDate(receipt.createdAt)}</td>
                    <td>{issuedTime(receipt.createdAt)}</td>
                    <td className="max-w-52 whitespace-normal font-semibold">
                      {receipt.client}
                    </td>
                    <td>{receipt.reservation}</td>
                    <td>{receipt.passengers}</td>
                    <td>{travelDateDisplay(receipt.travelDate)}</td>
                    <td className="max-w-60 whitespace-normal">
                      {receipt.destination}
                    </td>
                    <td>
                      <span className="rounded bg-subtle px-2 py-1 text-xs font-bold">
                        {receipt.currency}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {decimalDisplay(receipt.amount)}
                    </td>
                    <td className="tabular-nums">
                      {decimalDisplay(receipt.exchangeRate, 2, 6)}
                    </td>
                    <td className="font-bold tabular-nums">
                      {decimalDisplay(receipt.totalArs)}
                    </td>
                    <td>
                      <ReceiptActions receipt={receipt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !error && history?.receipts.length === 0 && (
            <div className="px-6 py-16 text-center">
              <FileText className="mx-auto mb-4 text-muted" size={32} />
              <h3 className="font-bold">
                {q || currency || from || to
                  ? "No hay recibos con estos filtros"
                  : "Todavía no hay recibos"}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {q || currency || from || to
                  ? "Probá otra búsqueda o cambiá el rango de fechas."
                  : "El primer comprobante que emitas aparecerá acá."}
              </p>
            </div>
          )}
          {loading && !history && (
            <p className="p-8 text-center text-muted" role="status">
              Cargando historial…
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 text-sm">
            <span className="text-muted">
              Página {page} de{" "}
              {Math.max(1, Math.ceil((history?.total ?? 0) / 20))}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1 || loading}
                className="btn-ghost px-3 py-2"
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={loading || page * 20 >= (history?.total ?? 0)}
                className="btn-ghost px-3 py-2"
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
