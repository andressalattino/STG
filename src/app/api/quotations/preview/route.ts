import { quotationDraftSchema } from "@/features/quotations/domain";
import { requireAdmin } from "@/server/auth";
import { apiError, readJson } from "@/server/http";
import { renderQuotationPdf } from "@/server/quotations/pdf";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const data = quotationDraftSchema.parse(await readJson(request));
    const now = new Date();
    const content = await renderQuotationPdf({
      id: "preview",
      number: 0,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + data.validityHours * 3600000,
      ).toISOString(),
      data,
    });
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="Vista_previa_cotizacion.pdf"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
