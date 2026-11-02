import Decimal from "decimal.js";
import { z } from "zod";

// Canonical decimals use a dot, no thousands separators; avoid binary floating-point arithmetic.
export const decimal = (scale: number, max: string) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{1,12}(?:[.,]\\d{1,${scale}})?$`),
      "Usá un importe positivo, sin separadores de miles.",
    )
    .transform((v) => v.replace(",", "."))
    .refine(
      (v) => new Decimal(v).gt(0) && new Decimal(v).lte(max),
      "El importe está fuera del rango permitido.",
    );
const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Completá los campos obligatorios.")
    .max(max, `Máximo ${max} caracteres.`)
    .refine(
      (v) =>
        Array.from(v).every(
          (character) =>
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      "El texto contiene caracteres no válidos.",
    );
export const paymentMethods = [
  "Pesos",
  "Dólares",
  "Tarjeta de crédito",
  "Tarjeta de débito",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type ReceiptPaymentDraft = {
  method: PaymentMethod;
  amount: string;
  exchangeRate?: string;
};
export type ReceiptPayment = {
  method: PaymentMethod;
  currency: "ARS" | "USD";
  amount: string;
  exchangeRate: string;
  totalArs: string;
};
export function calculatePayments(payments: ReceiptPaymentDraft[]) {
  const details: ReceiptPayment[] = payments.map((p) => {
    const currency = p.method === "Dólares" ? "USD" : "ARS";
    const amount = new Decimal(p.amount.replace(",", ".")).toFixed(2);
    const exchangeRate =
      currency === "USD"
        ? new Decimal((p.exchangeRate ?? "").replace(",", ".")).toFixed(6)
        : "1.000000";
    return {
      method: p.method,
      currency,
      amount,
      exchangeRate,
      totalArs: calculateTotal(amount, exchangeRate),
    };
  });
  return {
    payments: details,
    totalArs: details
      .reduce((sum, p) => sum.plus(p.totalArs), new Decimal(0))
      .toFixed(2),
  };
}
const paymentSchema = z
  .object({
    method: z.enum(paymentMethods),
    amount: decimal(2, "999999999999.99"),
    exchangeRate: decimal(6, "99999999.999999").optional(),
  })
  .superRefine((p, ctx) => {
    if (p.method === "Dólares" && !p.exchangeRate)
      ctx.addIssue({
        code: "custom",
        path: ["exchangeRate"],
        message: "Ingresá la cotización del dólar.",
      });
  });
export const receiptInputSchema = z
  .object({
    requestId: z.uuid(),
    client: cleanText(80),
    currency: z.enum(["ARS", "USD"]).optional(),
    amount: decimal(2, "999999999999.99").optional(),
    exchangeRate: decimal(6, "99999999.999999").optional(),
    reservation: cleanText(40),
    passengers: z.coerce.number().int().min(1).max(9999),
    travelDate: z.iso
      .date()
      .refine(
        (v) => v >= "1900-01-01" && v <= "2199-12-31",
        "Fecha de viaje inválida.",
      ),
    destination: cleanText(160),
    paymentMethod: z
      .enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"])
      .default("Transferencia"),
    rateSource: z
      .enum(["ars", "manual", "dolarapi-oficial-venta"])
      .default("manual"),
    quoteUpdatedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    payments: z
      .array(paymentSchema)
      .min(1, "Agregá al menos un pago.")
      .max(4, "El máximo es de cuatro métodos de pago.")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payments) {
      if (new Set(v.payments.map((p) => p.method)).size !== v.payments.length)
        ctx.addIssue({
          code: "custom",
          path: ["payments"],
          message: "Usá un único importe por método de pago.",
        });
      if (v.payments.some((p) => !paymentSchema.safeParse(p).success)) return;
      const { totalArs } = calculatePayments(v.payments);
      if (
        new Decimal(totalArs).gt(
          v.payments.length > 1 ? "999999999999.99" : "9999999999999999.99",
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["payments"],
          message: "El total supera el máximo permitido.",
        });
    } else {
      for (const key of ["currency", "amount", "exchangeRate"] as const)
        if (!v[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Completá la moneda, el importe y la cotización.",
          });
    }
  })
  .transform((v) => {
    if (v.payments) {
      const { payments, totalArs } = calculatePayments(v.payments);
      const single = payments.length === 1 ? payments[0] : null;
      const hasUsd = payments.some((p) => p.currency === "USD");
      return {
        ...v,
        currency: single?.currency ?? ("ARS" as const),
        amount: single?.amount ?? totalArs,
        exchangeRate: single?.exchangeRate ?? "1.000000",
        paymentMethod: single
          ? single.method.startsWith("Tarjeta")
            ? ("Tarjeta" as const)
            : ("Efectivo" as const)
          : ("Otro" as const),
        rateSource: !hasUsd
          ? ("ars" as const)
          : v.rateSource === "ars"
            ? ("manual" as const)
            : v.rateSource,
        quoteUpdatedAt:
          hasUsd && v.rateSource === "dolarapi-oficial-venta"
            ? (v.quoteUpdatedAt ?? null)
            : null,
        payments,
      };
    }
    return {
      ...v,
      currency: v.currency ?? "ARS",
      amount: new Decimal(v.amount ?? "0").toFixed(2),
      exchangeRate:
        v.currency === "ARS"
          ? "1.000000"
          : new Decimal(v.exchangeRate ?? "1").toFixed(6),
      rateSource:
        v.currency === "ARS"
          ? ("ars" as const)
          : v.rateSource === "ars"
            ? ("manual" as const)
            : v.rateSource,
      quoteUpdatedAt:
        v.currency === "ARS" || v.rateSource !== "dolarapi-oficial-venta"
          ? null
          : (v.quoteUpdatedAt ?? null),
      payments: undefined,
    };
  })
  .refine(
    (v) =>
      new Decimal(v.amount).times(v.exchangeRate).lte("9999999999999999.99"),
    "El total supera el máximo permitido.",
  );
export type ReceiptInput = z.infer<typeof receiptInputSchema>;
export type ReceiptRecord = Omit<ReceiptInput, "requestId" | "payments"> & {
  payments?: ReceiptPayment[];
  id: string;
  number: number;
  createdAt: string;
  totalArs: string;
  templateVersion: string;
};
export type Quote = {
  value: string;
  updatedAt: string;
  fetchedAt: string;
  source: "DolarAPI";
  side: "venta";
};
export function calculateTotal(amount: string, rate: string) {
  return new Decimal(amount.replace(",", "."))
    .times(rate.replace(",", "."))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
export function receiptNumber(number: number) {
  return String(number).padStart(6, "0");
}
export function decimalDisplay(value: string, min = 2, max = 2) {
  const fixed = new Decimal(value).toFixed(max, Decimal.ROUND_HALF_UP);
  const [whole, fractional = ""] = fixed.split(".");
  const fraction = fractional.replace(/0+$/, "").padEnd(min, "0");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction ? `,${fraction}` : "")
  );
}
export function issuedDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
export function issuedTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function travelDateDisplay(value: string) {
  return value.split("-").reverse().join("/");
}
export function receiptFilename(
  receipt: Pick<ReceiptRecord, "number" | "client">,
) {
  const name =
    receipt.client
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 70) || "Cliente";
  return `Recibo_${receiptNumber(receipt.number)}_${name}.pdf`;
}
