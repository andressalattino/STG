import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 32_768)
    throw new HttpError(413, "Solicitud demasiado grande.");
  const body = await request.text();
  if (body.length > 32_768)
    throw new HttpError(413, "Solicitud demasiado grande.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "El contenido de la solicitud no es válido.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues[0]?.message ?? "Datos inválidos.",
        fields: error.flatten().fieldErrors,
      },
      400,
    );
  const code = error instanceof Error ? error.message : "";
  if (code === "PDF_TEXT_OVERFLOW")
    return json(
      {
        error:
          "El texto es demasiado largo para la plantilla. Acortá el nombre o el destino.",
      },
      400,
    );
  if (code.includes("WinAnsi cannot encode"))
    return json(
      {
        error:
          "El texto contiene un símbolo que no se puede imprimir. Quitá emojis o símbolos especiales del nombre o del destino.",
      },
      400,
    );
  if (code === "DATABASE_URL_MISSING")
    return json(
      {
        error:
          "Falta configurar DATABASE_URL en el servidor. Consultá la guía de instalación.",
      },
      503,
    );
  console.error(
    "STG request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      error:
        "No se pudo completar la operación. Verificá la conexión y las migraciones de la base de datos.",
    },
    503,
  );
}
