import { useId } from "react";
import { decimalDisplay, travelDateDisplay } from "@/features/receipts/domain";
import type { Statistics } from "./domain";

const money = (value: string) => `ARS ${decimalDisplay(value)}`;
export function FinanceCharts({ data }: { data: Statistics }) {
  const barTitle = useId(),
    lineTitle = useId();
  const points = data.points;
  const width = 1000,
    height = 260,
    left = 80,
    right = 20,
    top = 20,
    bottom = 42;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const max = Math.max(
    1,
    ...points.flatMap((p) => [Number(p.income), Number(p.expenses)]),
  );
  const slot = plotWidth / Math.max(1, points.length),
    barWidth = Math.max(0.5, Math.min(22, slot * 0.32));
  const balances = points.map((p) => Number(p.balance));
  const minBalance = Math.min(0, ...balances),
    maxBalance = Math.max(0, ...balances) || (minBalance === 0 ? 1 : 0);
  const span = maxBalance - minBalance || 1;
  const y = (value: number) => top + ((maxBalance - value) / span) * plotHeight;
  const x = (index: number) => left + slot * (index + 0.5);
  const labels = points
    .map((p, i) => ({ p, i }))
    .filter(
      ({ i }) =>
        i % Math.max(1, Math.ceil(points.length / 8)) === 0 ||
        i === points.length - 1,
    );
  const compact = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  const dateLabel = (value: string) =>
    data.from.slice(0, 4) !== data.to.slice(0, 4)
      ? travelDateDisplay(value)
      : data.group === "month"
        ? `${value.slice(5, 7)}/${value.slice(2, 4)}`
        : travelDateDisplay(value).slice(0, 5);
  return (
    <div className="grid gap-6">
      <section className="surface-card min-w-0 p-5">
        <h2 className="text-xl font-bold">Ingresos y egresos</h2>
        <p className="mt-2 flex flex-wrap gap-5 text-sm">
          <span className="font-bold text-emerald-700">● Ingresos</span>
          <span className="font-bold text-amber-700">● Egresos</span>
          <span className="text-muted">Importes en ARS</span>
        </p>
        <div className="mt-4 overflow-x-auto">
          <svg
            role="img"
            aria-labelledby={barTitle}
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[540px] w-full"
          >
            <title id={barTitle}>
              Ingresos y egresos por período. Los valores exactos están en la
              tabla de detalle.
            </title>
            {[0, 0.25, 0.5, 0.75, 1].map((part) => (
              <g key={part}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={top + plotHeight * (1 - part)}
                  y2={top + plotHeight * (1 - part)}
                  stroke="currentColor"
                  opacity="0.12"
                />
                <text
                  x={left - 8}
                  y={top + plotHeight * (1 - part) + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="currentColor"
                >
                  {compact(max * part)}
                </text>
              </g>
            ))}
            {points.map((point, i) => (
              <g key={point.date}>
                <title>
                  {travelDateDisplay(point.date)}: ingresos{" "}
                  {money(point.income)}, egresos {money(point.expenses)}
                </title>
                <rect
                  x={x(i) - barWidth - 1}
                  y={top + plotHeight * (1 - Number(point.income) / max)}
                  width={barWidth}
                  height={(plotHeight * Number(point.income)) / max}
                  fill="#047857"
                  rx="2"
                />
                <rect
                  x={x(i) + 1}
                  y={top + plotHeight * (1 - Number(point.expenses) / max)}
                  width={barWidth}
                  height={(plotHeight * Number(point.expenses)) / max}
                  fill="#b45309"
                  rx="2"
                />
              </g>
            ))}
            {labels.map(({ p, i }) => (
              <text
                key={p.date}
                x={x(i)}
                y={height - 15}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
              >
                {dateLabel(p.date)}
              </text>
            ))}
          </svg>
        </div>
      </section>
      <section className="surface-card min-w-0 p-5">
        <h2 className="text-xl font-bold">Saldo por período</h2>
        <p className="mt-2 text-sm text-muted">
          Ingresos menos egresos en cada intervalo. Los valores por debajo de
          cero indican más pagos que cobros.
        </p>
        <div className="mt-4 overflow-x-auto">
          <svg
            role="img"
            aria-labelledby={lineTitle}
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[540px] w-full"
          >
            <title id={lineTitle}>
              Saldo por período en ARS. El saldo puede ser positivo o negativo.
            </title>
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              stroke="currentColor"
              opacity="0.4"
              strokeDasharray="5 4"
            />
            {[0, 0.5, 1].map((part) => (
              <text
                key={part}
                x={left - 8}
                y={top + plotHeight * part + 4}
                textAnchor="end"
                fontSize="12"
                fill="currentColor"
              >
                {compact(maxBalance - span * part)}
              </text>
            ))}
            <polyline
              points={points
                .map((p, i) => `${x(i)},${y(Number(p.balance))}`)
                .join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
            />
            {points.map((p, i) => (
              <circle
                key={p.date}
                cx={x(i)}
                cy={y(Number(p.balance))}
                r={points.length > 100 ? 2 : 4}
                fill={Number(p.balance) < 0 ? "#b91c1c" : "#2563eb"}
              >
                <title>
                  {travelDateDisplay(p.date)}: {money(p.balance)}
                </title>
              </circle>
            ))}
            {labels.map(({ p, i }) => (
              <text
                key={p.date}
                x={x(i)}
                y={height - 15}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
              >
                {dateLabel(p.date)}
              </text>
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
}
