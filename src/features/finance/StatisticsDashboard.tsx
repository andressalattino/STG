"use client";
import { type FormEvent, useEffect, useState } from "react";
import { Field } from "@/components/site/shared";
import { decimalDisplay, travelDateDisplay } from "@/features/receipts/domain";
import { apiRequest } from "@/lib/api";
import {
  presetRange,
  type Statistics,
  type StatisticsInput,
  statisticsSchema,
} from "./domain";
import { FinanceCharts } from "./FinanceCharts";
import { FinanceHeader } from "./FinanceHeader";
export function StatisticsDashboard({ onLogout }: { onLogout: () => void }) {
  const [draft, setDraft] = useState<StatisticsInput>(() => ({
    ...presetRange("month"),
    group: "auto",
  }));
  const [range, setRange] = useState(draft);
  const [selected, setSelected] = useState("month");
  const [data, setData] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision lets the admin refresh without changing the selected dates
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    void apiRequest<Statistics>(
      `/api/statistics?${new URLSearchParams(range)}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar las estadísticas.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, revision]);
  function preset(value: "week" | "month" | "year") {
    const next = { ...presetRange(value), group: "auto" as const };
    setDraft(next);
    setRange(next);
    setSelected(value);
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    const result = statisticsSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setSelected("custom");
    setRange(result.data);
  }
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceHeader
        title="Estadísticas"
        description="Compará los cobros registrados en recibos con tus pagos realizados. Todos los importes se expresan en ARS usando la cotización guardada en cada operación."
        onLogout={onLogout}
      />
      <section className="surface-card mb-6 p-5">
        <div className="mb-5 flex flex-wrap gap-3">
          {(
            [
              ["week", "Esta semana"],
              ["month", "Este mes"],
              ["year", "Este año"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={selected === value}
              className={selected === value ? "btn-primary" : "btn-secondary"}
              onClick={() => preset(value)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRevision((v) => v + 1)}
            disabled={loading}
          >
            Actualizar estadísticas
          </button>
        </div>
        <form
          onSubmit={apply}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Field label="Desde">
            <input
              type="date"
              className="admin-input"
              required
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              className="admin-input"
              required
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </Field>
          <Field label="Agrupar por">
            <select
              className="admin-input"
              value={draft.group}
              aria-label="Agrupar por"
              onChange={(e) =>
                setDraft({
                  ...draft,
                  group: e.target.value as StatisticsInput["group"],
                })
              }
            >
              <option value="auto">Automático</option>
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </Field>
          <button type="submit" className="btn-primary">
            Aplicar período
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Los accesos rápidos abarcan desde el inicio de la semana (lunes), mes
          o año hasta hoy. Las fechas personalizadas incluyen ambos días, según
          la hora de Argentina.
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-md bg-danger-soft p-4 text-danger"
        >
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="py-10 text-center">
          Calculando estadísticas…
        </p>
      )}
      {data && !loading && (
        <>
          <p className="mb-4 font-bold">
            Período: {travelDateDisplay(data.from)} al{" "}
            {travelDateDisplay(data.to)} · Agrupado por{" "}
            {data.group === "day"
              ? "día"
              : data.group === "week"
                ? "semana"
                : "mes"}
          </p>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {[
              ["Ingresos", data.income, "text-emerald-700"],
              ["Egresos", data.expenses, "text-amber-700"],
              [
                "Saldo (ingresos − egresos)",
                data.balance,
                data.balance.startsWith("-") ? "text-danger" : "text-stg-blue",
              ],
            ].map(([label, value, color]) => (
              <section key={label} className="surface-card min-w-0 p-5">
                <h2 className="text-sm font-bold text-muted">{label}</h2>
                <p className={`mt-3 break-words text-2xl font-black ${color}`}>
                  $ {decimalDisplay(value)}
                </p>
                <p className="mt-1 text-xs text-muted">ARS</p>
              </section>
            ))}
          </div>
          <p className="mb-6 text-sm text-muted">
            El saldo refleja cobros menos pagos registrados; no incluye
            operaciones que todavía no cargaste. Los egresos anulados no se
            cuentan.
          </p>
          <FinanceCharts data={data} />
          <details className="surface-card mt-6 p-5">
            <summary className="cursor-pointer font-bold">
              Ver detalle de los gráficos
            </summary>
            <p className="my-3 text-sm text-muted">
              Las fechas indican el inicio del intervalo. El primero y el último
              pueden ser parciales; solo incluyen movimientos dentro del período
              elegido.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Intervalo",
                      "Ingresos ARS",
                      "Egresos ARS",
                      "Saldo ARS",
                    ].map((label) => (
                      <th className="p-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.points.map((point) => (
                    <tr key={point.date} className="border-t border-line">
                      <td className="p-3">{travelDateDisplay(point.date)}</td>
                      <td className="p-3">{decimalDisplay(point.income)}</td>
                      <td className="p-3">{decimalDisplay(point.expenses)}</td>
                      <td className="p-3">{decimalDisplay(point.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
