"use client";
import { useEffect, useState } from "react";
import { FinanceHeader } from "@/features/finance/FinanceHeader";
import {
  decimalDisplay,
  issuedDate,
  receiptNumber,
  travelDateDisplay,
} from "@/features/receipts/domain";
import { apiRequest } from "@/lib/api";
import type { QuotationData, QuotationRecord } from "./domain";
import { QuotationActions } from "./QuotationActions";
import { QuotationForm } from "./QuotationForm";

type List = {
  quotations: QuotationRecord[];
  total: number;
  page: number;
  pageSize: number;
};
export function QuotationsWorkspace({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"new" | "history">("new"),
    [initial, setInitial] = useState<QuotationData>(),
    [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<QuotationRecord | null>(null),
    [list, setList] = useState<List | null>(null),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    void refresh;
    if (tab !== "history") return;
    const controller = new AbortController();
    setError("");
    setList(null);
    apiRequest<List>(
      `/api/quotations?${new URLSearchParams({ q: filter, page: String(page) })}`,
      { signal: controller.signal },
    )
      .then((v) => {
        if (!controller.signal.aborted) setList(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [tab, filter, page, refresh]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceHeader
        title="Cotizaciones"
        description="Propuestas de viaje a medida, listas para descargar, enviar e imprimir en A4."
        onLogout={onLogout}
      />
      <div className="mb-6 flex gap-3">
        <button
          type="button"
          className={tab === "new" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("new")}
        >
          Nueva cotización
        </button>
        <button
          type="button"
          className={tab === "history" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("history")}
        >
          Historial de cotizaciones
        </button>
      </div>
      {saved && (
        <div
          role="status"
          className="surface-card mb-6 border-l-4 border-l-stg-yellow p-5"
        >
          <p className="mb-3 font-bold">
            Cotización {receiptNumber(saved.number)} guardada para{" "}
            {saved.data.passenger}.
          </p>
          <QuotationActions key={saved.id} quotation={saved} />
          <p className="mt-3 text-sm text-muted">
            Descargá el PDF para adjuntarlo por WhatsApp o correo. Para
            imprimir, usá A4 al 100 %.
          </p>
        </div>
      )}
      <div hidden={tab !== "new"}>
        <QuotationForm
          key={formKey}
          initialData={initial}
          onSaved={(q) => {
            setSaved(q);
            setRefresh((v) => v + 1);
          }}
        />
      </div>
      {tab === "history" && (
        <section className="surface-card p-5">
          <h2 className="text-xl font-black">Historial de cotizaciones</h2>
          <form
            className="my-5 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter(search);
              setPage(1);
              setRefresh((v) => v + 1);
            }}
          >
            <input
              aria-label="Buscar cotizaciones"
              className="admin-input max-w-lg"
              placeholder="Pasajero, destino o número"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Buscar
            </button>
          </form>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {!list && !error && <p role="status">Cargando cotizaciones…</p>}
          {list && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b border-line text-muted">
                    <tr>
                      {[
                        "Número / emisión",
                        "Pasajero / destino",
                        "Viaje",
                        "Precio total",
                        "Validez",
                        "PDF / acciones",
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.quotations.map((q) => (
                      <tr key={q.id} className="border-b border-line">
                        <td className="p-3 font-bold">
                          {receiptNumber(q.number)}
                          <p className="font-normal text-muted">
                            {issuedDate(q.createdAt)}
                          </p>
                        </td>
                        <td className="p-3">
                          {q.data.passenger}
                          <p className="text-muted">
                            {q.data.destination} · {q.data.passengers} pasajeros
                          </p>
                        </td>
                        <td className="p-3">
                          {travelDateDisplay(q.data.startDate)}
                          <br />
                          {travelDateDisplay(q.data.endDate)}
                        </td>
                        <td className="whitespace-nowrap p-3 font-bold">
                          {q.data.currency} {decimalDisplay(q.data.amount)}
                        </td>
                        <td className="p-3">
                          {new Date(q.expiresAt).getTime() < Date.now()
                            ? "Vencida"
                            : "Vigente"}
                          <p className="text-xs text-muted">
                            Hasta{" "}
                            {new Date(q.expiresAt).toLocaleString("es-AR", {
                              timeZone: "America/Argentina/Buenos_Aires",
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </td>
                        <td className="p-3">
                          <QuotationActions quotation={q} />
                          <button
                            type="button"
                            className="mt-2 font-semibold text-stg-blue underline"
                            onClick={() => {
                              setInitial(q.data);
                              setFormKey((v) => v + 1);
                              setSaved(null);
                              setTab("new");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Usar como base
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.total === 0 && (
                <p className="py-8 text-center text-muted">
                  No hay cotizaciones para esta búsqueda.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {list.total} cotizaciones · Página {list.page}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={page * list.pageSize >= list.total}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
