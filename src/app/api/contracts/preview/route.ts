import { contractDraftSchema } from "@/features/contracts/domain";
import { requireAdmin } from "@/server/auth";
import { renderContractPdf } from "@/server/contracts/pdf";
import { apiError, readJson } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const data = contractDraftSchema.parse(await readJson(request, 131_072));
    const content = await renderContractPdf({
      id: "preview",
      number: 0,
      version: 1,
      previousId: null,
      createdAt: new Date().toISOString(),
      data,
    });
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="Contrato_borrador.pdf"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
