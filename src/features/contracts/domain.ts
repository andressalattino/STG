import Decimal from "decimal.js";
import { z } from "zod";

export const roomTypes = [
  "Single",
  "Doble matrimonial",
  "Doble individual",
  "Triple matrimonial",
  "Triple individual",
  "Cuádruple",
] as const;
export const mealTypes = [
  "Desayuno",
  "Media pensión",
  "Pensión completa",
  "All inclusive",
] as const;
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .refine(
      (v) =>
        Array.from(v).every(
          (c) =>
            c === "\n" ||
            c === "\r" ||
            c === "\t" ||
            (c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
        ),
      "El texto contiene caracteres no válidos.",
    );
const required = (max: number) =>
  text(max).min(1, "Completá los campos obligatorios.");
const date = z.iso
  .date()
  .refine((v) => v >= "1900-01-01" && v <= "2199-12-31", "Fecha inválida.");
const time = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida."),
]);
const money = (zero: boolean) =>
  z
    .string()
    .trim()
    .regex(
      /^\d{1,12}(?:[.,]\d{1,2})?$/,
      "Ingresá el importe sin separadores de miles.",
    )
    .transform((v) => v.replace(",", "."))
    .refine(
      (v) =>
        new Decimal(v).gte(zero ? 0 : "0.01") &&
        new Decimal(v).lte("999999999999.99"),
      "El importe está fuera de rango.",
    )
    .transform((v) => new Decimal(v).toFixed(2));
const departure = z.object({ date, time, place: required(180) });
const detail = z.object({ id: z.uuid(), description: required(600) });
const transportSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["Aéreo", "Bus"]),
    seat: z.enum(["Cama", "Semicama"]).nullable(),
    description: text(600),
  })
  .superRefine((v, ctx) => {
    if (v.type === "Aéreo" && !v.description)
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Completá las especificaciones del transporte aéreo.",
      });
    if (v.type === "Bus" && !v.seat)
      ctx.addIssue({
        code: "custom",
        path: ["seat"],
        message: "Elegí Cama o Semicama para el bus.",
      });
  })
  .transform((v) => ({ ...v, seat: v.type === "Aéreo" ? null : v.seat }));
export const contractDraftSchema = z
  .object({
    destination: required(160),
    reservationNumber: text(60).default(""),
    departure,
    return: departure,
    hotels: z
      .array(
        z.object({
          id: z.uuid(),
          name: required(120),
          stars: z.coerce.number().int().min(0).max(5),
          checkIn: date,
          checkOut: date,
          rooms: z
            .array(
              z.object({
                id: z.uuid(),
                type: z.enum(roomTypes),
                quantity: z.coerce.number().int().min(1).max(6),
              }),
            )
            .min(1)
            .max(6),
          meals: z
            .array(z.enum(mealTypes))
            .max(1, "Elegí un único régimen de comidas por hotel."),
        }),
      )
      .max(3, "El máximo es de 3 hoteles por contrato."),
    excursions: z.array(detail).max(20),
    transport: z.array(transportSchema).max(20).default([]),
    passengers: z
      .array(
        z.object({
          id: z.uuid(),
          name: required(120),
          dni: z
            .string()
            .trim()
            .regex(
              /^\d{6,10}$/,
              "Ingresá el DNI con 6 a 10 números, sin puntos.",
            ),
          birthDate: date.refine(
            (v) =>
              v <=
              new Date().toLocaleDateString("en-CA", {
                timeZone: "America/Argentina/Buenos_Aires",
              }),
            "El nacimiento no puede ser futuro.",
          ),
          phone: text(40),
        }),
      )
      .min(1, "Agregá al menos un pasajero.")
      .max(6, "El máximo es de 6 pasajeros por contrato."),
    currency: z.enum(["ARS", "USD"]),
    unitPrice: money(false),
    totalOverride: money(false).nullable().default(null),
    deposit: money(true),
    exchangeRate: z
      .string()
      .trim()
      .regex(/^\d{1,8}(?:[.,]\d{1,6})?$/, "Cotización inválida.")
      .transform((v) => v.replace(",", "."))
      .refine(
        (v) => new Decimal(v).gt(0),
        "La cotización debe ser mayor a cero.",
      ),
    rateSource: z.enum(["ars", "manual", "dolarapi-oficial-venta"]),
    quoteUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    notes: text(3000),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (
      v.return.date < v.departure.date ||
      (v.return.date === v.departure.date &&
        v.departure.time &&
        v.return.time &&
        v.return.time < v.departure.time)
    )
      issue(["return"], "El regreso debe ser posterior a la salida.");
    v.hotels.forEach((h, i) => {
      if (h.checkOut <= h.checkIn)
        issue(
          ["hotels", i, "checkOut"],
          "El egreso debe ser posterior al ingreso al hotel.",
        );
      if (h.checkIn < v.departure.date || h.checkOut > v.return.date)
        issue(
          ["hotels", i],
          "Las fechas del hotel deben estar dentro del viaje.",
        );
    });
    if (new Set(v.passengers.map((p) => p.dni)).size !== v.passengers.length)
      issue(["passengers"], "Hay pasajeros con el mismo DNI.");
    const total =
      v.totalOverride === null
        ? new Decimal(v.unitPrice).times(v.passengers.length)
        : new Decimal(v.totalOverride);
    if (total.gt("999999999999.99"))
      issue(["unitPrice"], "El total supera el máximo permitido.");
    if (new Decimal(v.deposit).gt(total))
      issue(["deposit"], "La seña no puede superar el total.");
    if (
      total
        .times(v.currency === "ARS" ? 1 : v.exchangeRate)
        .gt("9999999999999999.99")
    )
      issue(
        ["exchangeRate"],
        "El equivalente en pesos supera el máximo permitido.",
      );
  })
  .transform((v) => ({
    ...v,
    exchangeRate:
      v.currency === "ARS"
        ? "1.000000"
        : new Decimal(v.exchangeRate).toFixed(6),
    rateSource:
      v.currency === "ARS"
        ? ("ars" as const)
        : v.rateSource === "ars"
          ? ("manual" as const)
          : v.rateSource,
    quoteUpdatedAt:
      v.currency === "USD" && v.rateSource === "dolarapi-oficial-venta"
        ? v.quoteUpdatedAt
        : null,
  }));
export const contractInputSchema = z.object({
  requestId: z.uuid(),
  previousId: z.uuid().nullable(),
  data: contractDraftSchema,
});
export type ContractData = z.infer<typeof contractDraftSchema>;
export type ContractInput = z.infer<typeof contractInputSchema>;
export type ContractRecord = {
  id: string;
  number: number;
  version: number;
  previousId: string | null;
  createdAt: string;
  data: ContractData;
};
export function contractTotals(
  data: Pick<
    ContractData,
    "unitPrice" | "deposit" | "passengers" | "exchangeRate"
  > & { totalOverride?: string | null },
) {
  const automatic = new Decimal(data.unitPrice.replace(",", ".")).times(
    data.passengers.length,
  );
  const total =
    data.totalOverride == null
      ? automatic
      : new Decimal(data.totalOverride.replace(",", "."));
  return {
    total: total.toFixed(2),
    remaining: total.minus(data.deposit.replace(",", ".")).toFixed(2),
    totalArs: total.times(data.exchangeRate.replace(",", ".")).toFixed(2),
  };
}

// Adapt older JSON records for the editor/history without rewriting their saved PDFs.
export function normalizeContractData(data: ContractData): ContractData {
  const legacy = data as ContractData & {
    flights?: { id: string; description: string }[];
  };
  const roomAliases: Record<
    string,
    ContractData["hotels"][number]["rooms"][number]["type"]
  > = {
    Individual: "Single",
    "Doble camas separadas": "Doble individual",
    Triple: "Triple individual",
  };
  return {
    ...data,
    reservationNumber: data.reservationNumber ?? "",
    totalOverride: data.totalOverride ?? null,
    transport:
      data.transport ??
      (legacy.flights ?? []).map((f) => ({
        ...f,
        type: "Aéreo" as const,
        seat: null,
      })),
    hotels: data.hotels.map((h) => {
      const meals = h.meals as string[];
      const plan = meals.includes("All inclusive")
        ? "All inclusive"
        : meals.includes("Pensión completa") || meals.length === 3
          ? "Pensión completa"
          : meals.includes("Media pensión") || meals.length === 2
            ? "Media pensión"
            : meals.includes("Desayuno")
              ? "Desayuno"
              : null;
      return {
        ...h,
        meals: plan ? [plan] : [],
        rooms: h.rooms.map((r) => ({
          ...r,
          type: roomAliases[r.type] ?? r.type,
        })),
      };
    }),
  };
}
export function contractLabel(
  record: Pick<ContractRecord, "number" | "version">,
) {
  return `${String(record.number).padStart(6, "0")} · v${record.version}`;
}
export function contractFilename(
  record: Pick<ContractRecord, "number" | "version">,
) {
  return `Contrato_${String(record.number).padStart(6, "0")}_v${record.version}.pdf`;
}
export function contractSearchTerm(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
