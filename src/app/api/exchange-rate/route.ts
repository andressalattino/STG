import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { apiError, HttpError, json } from "@/server/http";
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const response = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        "No se pudo consultar el dólar oficial. Ingresá la cotización manualmente.",
      );
    const quote = z
      .object({
        venta: z.number().positive().max(99999999),
        fechaActualizacion: z.iso.datetime({ offset: true }),
        casa: z.literal("oficial"),
      })
      .parse(await response.json());
    if (new Date(quote.fechaActualizacion).getTime() > Date.now() + 300000)
      throw new HttpError(
        502,
        "El proveedor devolvió una fecha inválida. Ingresá la cotización manualmente.",
      );
    return json({
      value: String(quote.venta),
      updatedAt: quote.fechaActualizacion,
      fetchedAt: new Date().toISOString(),
      source: "DolarAPI",
      side: "venta",
    });
  } catch (error) {
    return error instanceof HttpError && [401, 403, 503].includes(error.status)
      ? apiError(error)
      : json(
          {
            error:
              "Cotización no disponible. Podés ingresar el dólar oficial manualmente.",
          },
          502,
        );
  }
}
