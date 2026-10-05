import Decimal from "decimal.js";
import { z } from "zod";
import { decimal } from "@/features/receipts/domain";

const Money = Decimal.clone({ precision: 40 });

export const categories = [
  "Alojamiento",
  "Transporte",
  "Excursiones",
  "Proveedores",
  "Sueldos",
  "Impuestos",
  "Servicios",
  "Otros",
] as const;
export const paymentMethods = [
  "Transferencia",
  "Efectivo",
  "Tarjeta",
  "Otro",
] as const;
export const dateSchema = z.iso
  .date()
  .refine(
    (v) => v >= "1900-01-01" && v <= "2199-12-31",
    "Fecha fuera de rango.",
  );
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Completá los campos obligatorios.")
    .max(max)
    .refine(
      (v) =>
        Array.from(v).every(
          (character) =>
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      "Texto no válido.",
    );
export const expenseInputSchema = z
  .object({
    requestId: z.uuid(),
    paidOn: dateSchema,
    payee: text(120),
    concept: text(200),
    category: z.enum(categories),
    currency: z.enum(["ARS", "USD"]),
    amount: decimal(2, "999999999999.99"),
    exchangeRate: decimal(6, "99999999.999999"),
    paymentMethod: z.enum(paymentMethods),
    reference: z.string().trim().max(120).default(""),
    notes: z.string().trim().max(1000).default(""),
  })
  .transform((v) => ({
    ...v,
    amount: new Decimal(v.amount).toFixed(2),
    exchangeRate:
      v.currency === "ARS"
        ? "1.000000"
        : new Decimal(v.exchangeRate).toFixed(6),
  }))
  .refine(
    (v) =>
      new Decimal(v.amount).times(v.exchangeRate).lte("9999999999999999.99"),
    "El total supera el máximo permitido.",
  );
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseRecord = Omit<ExpenseInput, "requestId"> & {
  id: string;
  createdAt: string;
  totalArs: string;
  voidedAt: string | null;
  voidReason: string | null;
};
export const voidExpenseSchema = z.object({
  reason: text(300).refine(
    (v) => v.length >= 3,
    "Indicá el motivo de la anulación.",
  ),
});

export const rangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine(
    (v) => v.from <= v.to,
    "La fecha inicial debe ser anterior o igual a la final.",
  )
  .refine(
    (v) => (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 3660,
    "Elegí un período de hasta diez años.",
  );
export const statisticsSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    group: z.enum(["auto", "day", "week", "month"]).default("auto"),
  })
  .superRefine((v, ctx) => {
    const result = rangeSchema.safeParse(v);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({ code: "custom", message: issue.message });
    if (
      v.group === "day" &&
      (Date.parse(v.to) - Date.parse(v.from)) / 86400000 > 366
    )
      ctx.addIssue({
        code: "custom",
        message: "Para más de un año, agrupá por semana, mes o automático.",
      });
  });
export type StatisticsInput = z.infer<typeof statisticsSchema>;
export type Group = "day" | "week" | "month";
export type Statistics = {
  from: string;
  to: string;
  group: Group;
  income: string;
  expenses: string;
  balance: string;
  points: { date: string; income: string; expenses: string; balance: string }[];
};
export function argentinaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function presetRange(
  preset: "week" | "month" | "year",
  today = argentinaToday(),
) {
  const start = new Date(`${today}T00:00:00Z`);
  if (preset === "week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (preset === "month") start.setUTCDate(1);
  if (preset === "year") {
    start.setUTCMonth(0, 1);
  }
  return { from: start.toISOString().slice(0, 10), to: today };
}
export function bucketDate(date: string, group: Group) {
  const d = new Date(`${date}T00:00:00Z`);
  if (group === "week")
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (group === "month") d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}
export function fillStatistics(
  input: StatisticsInput,
  rows: { date: string; income: string; expenses: string }[],
): Statistics {
  const days = (Date.parse(input.to) - Date.parse(input.from)) / 86400000 + 1;
  const group =
    input.group === "auto"
      ? days <= 62
        ? "day"
        : days <= 366
          ? "week"
          : "month"
      : input.group;
  const map = new Map(rows.map((row) => [row.date, row]));
  let income = new Money(0),
    expenses = new Money(0);
  const points: Statistics["points"] = [];
  const end = bucketDate(input.to, group);
  for (let date = bucketDate(input.from, group); date <= end; ) {
    const row = map.get(date);
    const incoming = new Money(row?.income ?? 0),
      outgoing = new Money(row?.expenses ?? 0);
    income = income.plus(incoming);
    expenses = expenses.plus(outgoing);
    points.push({
      date,
      income: incoming.toFixed(2),
      expenses: outgoing.toFixed(2),
      balance: incoming.minus(outgoing).toFixed(2),
    });
    const next = new Date(`${date}T00:00:00Z`);
    if (group === "month") next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCDate(next.getUTCDate() + (group === "week" ? 7 : 1));
    date = next.toISOString().slice(0, 10);
  }
  return {
    from: input.from,
    to: input.to,
    group,
    income: income.toFixed(2),
    expenses: expenses.toFixed(2),
    balance: income.minus(expenses).toFixed(2),
    points,
  };
}
