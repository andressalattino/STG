"use client";
import { useEffect, useState } from "react";
import { FinanceHeader } from "@/features/finance/FinanceHeader";
import {
  decimalDisplay,
  issuedDate,
  issuedTime,
  travelDateDisplay,
} from "@/features/receipts/domain";
import { apiRequest } from "@/lib/api";
import { ContractActions } from "./ContractActions";
import { ContractForm } from "./ContractForm";
import { type ContractRecord, contractLabel, contractTotals } from "./domain";

type List = {
  contracts: (ContractRecord & { isLatest: boolean })[];
  total: number;
  page: number;
  pageSize: number;
};

export function ContractsWorkspace({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"new" | "history">("new"),
    [source, setSource] = useState<ContractRecord>(),
    [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<ContractRecord | null>(null),
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
      `/api/contracts?${new URLSearchParams({ q: filter, page: String(page) })}`,
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
  function reset() {
    setSource(undefined);
    setFormKey((v) => v + 1);
  }
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceHeader
        title="Contratos"
        description="Reservas de viaje con pasajeros, hoteles y precios. PDF A4 listo para imprimir y firmar."
        onLogout={onLogout}
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          className={tab === "new" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("new")}
        >
          {source ? "Nueva versión" : "Nuevo contrato"}
        </button>
        <button
          type="button"
          className={tab === "history" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("history")}
        >
          Historial de contratos
        </button>
      </div>
      {saved && (
        <div
          role="status"
          className="surface-card mb-6 border-l-4 border-l-stg-yellow p-5"
        >
          <p className="mb-3 font-bold">
            Contrato {contractLabel(saved)} guardado.
          </p>
          <ContractActions key={saved.id} contract={saved} />
          <p className="mt-3 text-sm text-muted">
            Imprimí en A4, tamaño real / 100 %. Incluye espacios para las firmas
            a mano del cliente y del vendedor.
          </p>
        </div>
      )}
      <div hidden={tab !== "new"}>
        <ContractForm
          key={formKey}
          source={source}
          onCancelVersion={reset}
          onSaved={(record) => {
            setSaved(record);
            setRefresh((v) => v + 1);
            reset();
          }}
        />
      </div>
      {tab === "history" && (
        <section className="surface-card p-5">
          <h2 className="text-xl font-black">Historial de contratos</h2>
          <p className="mt-2 text-sm text-muted">
            Cada versión conserva su PDF original. Las correcciones parten de la
            versión más reciente.
          </p>
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
              aria-label="Buscar contratos"
              className="admin-input max-w-lg"
              placeholder="Número, pasajero, DNI o destino"
              value={search}
              maxLength={120}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Buscar
            </button>
          </form>
          {error && (
            <div role="alert" className="space-y-3 text-danger">
              <p>{error}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRefresh((v) => v + 1)}
              >
                Reintentar carga
              </button>
            </div>
          )}
          {!list && !error && <p role="status">Cargando contratos…</p>}
          {list && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-line text-muted">
                    <tr>
                      {[
                        "Número / versión",
                        "Pasajeros / destino",
                        "Viaje",
                        "Total / resto",
                        "PDF / acciones",
                      ].map((label) => (
                        <th key={label} className="p-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.contracts.map((record) => {
                      const totals = contractTotals(record.data);
                      return (
                        <tr key={record.id} className="border-b border-line">
                          <td className="p-3">
                            <p className="font-bold">{contractLabel(record)}</p>
                            <p className="mt-1 text-xs text-muted">
                              {issuedDate(record.createdAt)} ·{" "}
                              {issuedTime(record.createdAt)}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {record.isLatest
                                ? "Última versión"
                                : "Versión anterior"}
                            </p>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold">
                              {record.data.passengers[0].name}
                            </p>
                            <p className="text-muted">
                              {record.data.passengers.length} pasajeros ·{" "}
                              {record.data.destination}
                            </p>
                          </td>
                          <td className="p-3">
                            {travelDateDisplay(record.data.departure.date)}
                            <br />
                            {travelDateDisplay(record.data.return.date)}
                          </td>
                          <td className="whitespace-nowrap p-3">
                            <p className="font-bold">
                              {record.data.currency}{" "}
                              {decimalDisplay(totals.total)}
                            </p>
                            <p className="text-xs text-muted">
                              Resto: {record.data.currency}{" "}
                              {decimalDisplay(totals.remaining)}
                            </p>
                          </td>
                          <td className="p-3">
                            <ContractActions contract={record} />
                            {record.isLatest && (
                              <button
                                type="button"
                                className="mt-3 font-bold text-stg-blue underline"
                                onClick={() => {
                                  setSource(record);
                                  setFormKey((v) => v + 1);
                                  setSaved(null);
                                  setTab("new");
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                Crear nueva versión
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {list.total === 0 && (
                <p className="py-8 text-center text-muted">
                  No hay contratos para esta búsqueda.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {list.total} versiones · Página {list.page}
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
    </div>
  );
}
