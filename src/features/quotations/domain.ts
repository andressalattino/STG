import Decimal from "decimal.js";
import { z } from "zod";
import { decimal } from "@/features/receipts/domain";

export const boards = [
  "Pensión completa",
  "All inclusive",
  "Solo desayuno",
  "Media pensión",
  "Sin pensión",
] as const;
export const transportTypes = ["Aéreo", "Bus", "Tren", "Crucero"] as const;
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
const money = decimal(2, "999999999999.99").transform((v) =>
  new Decimal(v).toFixed(2),
);
const date = z.iso
  .date()
  .refine((v) => v >= "1900-01-01" && v <= "2199-12-31", "Fecha inválida.");
export const legSchema = z.object({
  mode: z.enum(transportTypes),
  from: required(90),
  to: required(90),
});
export const quotationDraftSchema = z
  .object({
    passenger: required(100),
    passengers: z.coerce.number().int().min(1).max(999),
    destination: required(160),
    startDate: date,
    endDate: date,
    amount: money,
    currency: z.enum(["ARS", "USD"]),
    exchangeRate: decimal(6, "99999999.999999"),
    validityHours: z.coerce.number().int().min(1).max(2160),
    board: z.enum(boards),
    carryOn: z.coerce.number().int().min(0).max(999),
    checkedBags: z.coerce.number().int().min(0).max(999),
    baggageNotes: text(400),
    transport: z.enum(["Clásico", "Mixto"]),
    roundTrip: z.boolean(),
    legs: z.array(legSchema).min(1).max(6),
    lodging: z.boolean(),
    nights: z.coerce.number().int().min(0).max(999),
    hotels: z
      .array(
        z.object({ name: required(120), board: z.enum(boards), price: money }),
      )
      .max(8),
    assistance: z.boolean(),
    assistanceName: text(120),
    assistanceNotes: text(400),
    transfers: z.boolean(),
    transferNotes: text(400),
    excursions: z.boolean(),
    excursionDetails: text(700),
    notes: text(2000),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.endDate < v.startDate)
      issue(
        "endDate",
        "La fecha de regreso debe ser igual o posterior a la salida.",
      );
    if (v.transport === "Clásico" && v.legs.length !== 1)
      issue("legs", "El transporte clásico admite un solo tramo de ida.");
    if (v.lodging && (!v.hotels.length || v.nights < 1))
      issue("hotels", "Agregá al menos un hospedaje y una noche.");
    if (v.assistance && !v.assistanceName)
      issue("assistanceName", "Indicá el nombre de la asistencia al viajero.");
    if (v.excursions && !v.excursionDetails)
      issue("excursionDetails", "Detallá las excursiones incluidas.");
  })
  .transform((v) => ({
    ...v,
    exchangeRate:
      v.currency === "ARS"
        ? "1.000000"
        : new Decimal(v.exchangeRate).toFixed(6),
    nights: v.lodging ? v.nights : 0,
    hotels: v.lodging ? v.hotels : [],
    assistanceName: v.assistance ? v.assistanceName : "",
    assistanceNotes: v.assistance ? v.assistanceNotes : "",
    transferNotes: v.transfers ? v.transferNotes : "",
    excursionDetails: v.excursions ? v.excursionDetails : "",
  }));
export const quotationInputSchema = z.object({
  requestId: z.uuid(),
  data: quotationDraftSchema,
});
export type QuotationData = z.infer<typeof quotationDraftSchema>;
export type QuotationInput = z.infer<typeof quotationInputSchema>;
export type QuotationRecord = {
  id: string;
  number: number;
  createdAt: string;
  expiresAt: string;
  data: QuotationData;
};
export function returnLegs(legs: QuotationData["legs"]) {
  return [...legs]
    .reverse()
    .map((leg) => ({ mode: leg.mode, from: leg.to, to: leg.from }));
}
export function tripNights(start: string, end: string) {
  const count = (Date.parse(end) - Date.parse(start)) / 86400000;
  return Number.isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
}
export function quotationFilename(q: Pick<QuotationRecord, "number" | "data">) {
  const name = q.data.passenger
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 60);
  return `Cotizacion_${String(q.number).padStart(6, "0")}_${name}.pdf`;
}
