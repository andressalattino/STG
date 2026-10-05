"use client";
import { type FormEvent, useEffect, useState } from "react";
import { Field } from "@/components/site/shared";
import { decimalDisplay, travelDateDisplay } from "@/features/receipts/domain";
import { apiRequest } from "@/lib/api";
import type { ExpenseRecord } from "./domain";
import { ExpenseForm } from "./ExpenseForm";
import { FinanceHeader } from "./FinanceHeader";

type History = {
  expenses: ExpenseRecord[];
  total: number;
  page: number;
  pageSize: number;
};
export function ExpensesWorkspace({ onLogout }: { onLogout: () => void }) {
  const [history, setHistory] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    from: "",
    to: "",
    status: "active",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [voiding, setVoiding] = useState<ExpenseRecord | null>(null);
  const [reason, setReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision reloads history after a write
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(applied))
      if (value) params.set(key, value);
    void apiRequest<History>(`/api/expenses?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setHistory(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setHistory(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar el historial.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [applied, page, revision]);
  function search(event: FormEvent) {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setError("Revisá el orden de las fechas.");
      return;
    }
    setPage(1);
    setApplied({ ...filters });
  }
  async function cancel(event: FormEvent) {
    event.preventDefault();
    if (!voiding || voidBusy) return;
    setVoidBusy(true);
    setError("");
    try {
      await apiRequest(`/api/expenses/${voiding.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setVoiding(null);
      setReason("");
      setNotice("Egreso anulado. Ya no se incluye en las estadísticas.");
      setRevision((v) => v + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo anular.");
    } finally {
      setVoidBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceHeader
        title="Egresos y pagos"
        description="Registrá los pagos realizados y consultá su historial. Los egresos activos se descuentan de los ingresos en las estadísticas."
        onLogout={onLogout}
      />
      {notice && (
        <p role="status" className="mb-5 rounded-md bg-tint p-4">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ExpenseForm
          onSaved={() => {
            setNotice("Egreso guardado correctamente.");
            setPage(1);
            setRevision((v) => v + 1);
          }}
        />
        <section className="surface-card min-w-0 p-5">
          <h2 className="mb-4 text-xl font-bold">Historial de egresos</h2>
          <form onSubmit={search} className="mb-5 grid gap-3 sm:grid-cols-2">
            <Field label="Buscar egreso">
              <input
                className="admin-input"
                placeholder="Destinatario, concepto o referencia"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </Field>
            <Field label="Estado">
              <select
                className="admin-input"
                value={filters.status}
                aria-label="Estado"
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="active">Activos</option>
                <option value="voided">Anulados</option>
                <option value="all">Todos</option>
              </select>
            </Field>
            <Field label="Pagos desde">
              <input
                type="date"
                className="admin-input"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </Field>
            <Field label="Pagos hasta">
              <input
                type="date"
                className="admin-input"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </Field>
            <button type="submit" className="btn-secondary">
              Filtrar egresos
            </button>
          </form>
          {error && (
            <p role="alert" className="my-4 text-danger">
              {error}
            </p>
          )}
          {voiding && (
            <form
              onSubmit={cancel}
              className="mb-5 grid gap-3 rounded-md border border-line bg-tint p-4"
            >
              <h3 className="font-bold">Anular pago a {voiding.payee}</h3>
              <p>
                El registro se conserva y se excluye de los totales. Para
                corregir sus datos, cargá luego un egreso nuevo.
              </p>
              <Field label="Motivo de anulación">
                <input
                  className="admin-input"
                  required
                  minLength={3}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={voidBusy}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={voidBusy}
                >
                  Confirmar anulación
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={voidBusy}
                  onClick={() => setVoiding(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {busy ? (
            <p role="status">Cargando egresos…</p>
          ) : (
            history && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Pagos registrados en el período seleccionado
                    </caption>
                    <thead>
                      <tr className="border-b border-line">
                        {[
                          "Fecha",
                          "Destinatario / concepto",
                          "Moneda",
                          "Importe",
                          "Cotización",
                          "Total ARS",
                          "Acciones",
                        ].map((label) => (
                          <th key={label} className="whitespace-nowrap p-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.expenses.map((row) => (
                        <tr key={row.id} className="border-b border-line">
                          <td className="whitespace-nowrap p-3">
                            {travelDateDisplay(row.paidOn)}
                          </td>
                          <td className="min-w-44 p-3">
                            <strong>{row.payee}</strong>
                            <p>{row.concept}</p>
                            <p className="text-xs text-muted">
                              {row.category} · {row.paymentMethod}
                            </p>
                            {row.reference && (
                              <p className="text-xs">Ref.: {row.reference}</p>
                            )}
                            {row.notes && (
                              <details className="mt-1 text-xs">
                                <summary>Notas</summary>
                                {row.notes}
                              </details>
                            )}
                            {row.voidedAt && (
                              <p className="mt-1 text-danger">
                                Anulado: {row.voidReason}
                              </p>
                            )}
                          </td>
                          <td className="p-3">{row.currency}</td>
                          <td className="whitespace-nowrap p-3">
                            {decimalDisplay(row.amount)}
                          </td>
                          <td className="whitespace-nowrap p-3">
                            {decimalDisplay(row.exchangeRate, 2, 6)}
                          </td>
                          <td className="whitespace-nowrap p-3 font-bold">
                            $ {decimalDisplay(row.totalArs)}
                          </td>
                          <td className="p-3">
                            {!row.voidedAt && (
                              <button
                                type="button"
                                className="font-bold underline"
                                aria-label={`Anular egreso: ${row.concept}`}
                                onClick={() => {
                                  setVoiding(row);
                                  setReason("");
                                }}
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!history.expenses.length && (
                  <p className="py-8 text-center text-muted">
                    No hay egresos para estos filtros.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm">
                    {history.total} egresos · Página {page}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={page * history.pageSize >= history.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </section>
      </div>
    </section>
  );
}
