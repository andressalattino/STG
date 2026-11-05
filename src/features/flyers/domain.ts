import { z } from "zod";

export const flyerLimits = {
  title: 72,
  company: 52,
  hotel: 64,
  duration: 365,
};

export const hotelSlots = [0, 1, 2, 3] as const;

const hotelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del hotel.")
    .max(flyerLimits.hotel),
  date: z.iso.date("Ingresá una fecha válida para el hotel."),
  price: z
    .string()
    .trim()
    .regex(
      /^\d{1,9}([.,]\d{1,2})?$/,
      "Ingresá un precio válido sin separador de miles (por ejemplo, 150000 o 150000,50).",
    )
    .transform((value) => value.replace(",", ".")),
});

export const flyerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del viaje.")
    .max(flyerLimits.title),
  days: z
    .number()
    .int()
    .min(1, "Ingresá al menos 1 día.")
    .max(flyerLimits.duration),
  nights: z.number().int().min(0).max(flyerLimits.duration),
  transport: z.enum(["Cama", "Semicama"]),
  company: z
    .string()
    .trim()
    .min(1, "Ingresá la empresa de transporte.")
    .max(flyerLimits.company),
  hotels: z.array(hotelSchema.nullable()).length(hotelSlots.length),
});

export type FlyerData = z.output<typeof flyerSchema>;
export type FlyerRecord = {
  id: string;
  data: FlyerData;
  updatedAt: string;
};

export function flyerDuration(days: number, nights: number) {
  return `${days} ${days === 1 ? "día" : "días"} y ${nights} ${nights === 1 ? "noche" : "noches"}`;
}
