import {
  type ReceiptRecord,
  receiptFilename,
} from "@/features/receipts/domain";
export function pdfResponse(
  content: Buffer,
  receipt: Pick<ReceiptRecord, "number" | "client">,
  download = false,
) {
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${receiptFilename(receipt)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
