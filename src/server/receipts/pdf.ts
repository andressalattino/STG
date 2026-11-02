import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  decimalDisplay,
  issuedDate,
  issuedTime,
  type ReceiptRecord,
  receiptNumber,
  travelDateDisplay,
} from "@/features/receipts/domain";

let template: Promise<Buffer> | undefined;
function fitText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  top: number,
  width: number,
  size: number,
  align: "left" | "right" = "left",
) {
  // Failing before the transaction commits is preferable to silently dropping a name.
  let actualSize = size;
  while (font.widthOfTextAtSize(value, actualSize) > width && actualSize > 6)
    actualSize -= 0.25;
  if (font.widthOfTextAtSize(value, actualSize) > width)
    throw new Error("PDF_TEXT_OVERFLOW");
  const offset =
    align === "right" ? width - font.widthOfTextAtSize(value, actualSize) : 0;
  page.drawText(value, {
    x: x + offset,
    y: page.getHeight() - top - size * 0.82,
    size: actualSize,
    font,
  });
}
function descriptionLines(value: string, font: PDFFont, width: number) {
  const words = value.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, 8) > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  if (lines.length > 3) throw new Error("PDF_TEXT_OVERFLOW");
  return lines;
}
export async function renderReceiptPdf(receipt: ReceiptRecord) {
  template ??= readFile(
    path.join(process.cwd(), "assets/receipts/template-v1.pdf"),
  );
  const doc = await PDFDocument.load(await template);
  const page = doc.getPage(0);
  if (
    doc.getPageCount() !== 1 ||
    Math.abs(page.getWidth() - 595.28) > 1 ||
    Math.abs(page.getHeight() - 841.89) > 1
  )
    throw new Error("PDF_TEMPLATE_INVALID");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const description = `Reserva ${receipt.reservation} - ${receipt.client} x${receipt.passengers} - ${travelDateDisplay(receipt.travelDate)} - ${receipt.destination}`;
  const lines = descriptionLines(description, regular, 488);
  for (const offset of [0, 307.22]) {
    fitText(
      page,
      bold,
      `RECIBO N.º ${receiptNumber(receipt.number)}`,
      394.44,
      61.41 + offset,
      148,
      11.22,
    );
    fitText(
      page,
      regular,
      `${issuedDate(receipt.createdAt)} ${issuedTime(receipt.createdAt)}`,
      450,
      131.08 + offset,
      92.84,
      7.48,
      "right",
    );
    fitText(page, bold, receipt.client, 52.13, 156.45 + offset, 340, 9.72);
    fitText(
      page,
      bold,
      `$${decimalDisplay(receipt.totalArs)}`,
      397,
      154.95 + offset,
      145.84,
      11.22,
      "right",
    );
    // Three short lines fit in the original description box without moving its borders.
    lines.forEach((line, index) => {
      fitText(
        page,
        regular,
        line,
        52.13,
        (lines.length === 1 ? 206.27 : 193.5) + index * 8.5 + offset,
        489,
        8,
      );
    });
    if (receipt.payments?.length) {
      if (receipt.payments.length > 4) throw new Error("PDF_TEXT_OVERFLOW");
      // Reuse the existing payment area; neither copy, signature nor travel box moves.
      page.drawRectangle({
        x: 49,
        y: page.getHeight() - 286 - offset,
        width: 498,
        height: 68,
        color: rgb(1, 1, 1),
      });
      page.drawRectangle({
        x: 49.82468,
        y: page.getHeight() - 284 - offset,
        width: 495.35061,
        height: 65,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      fitText(page, bold, "DETALLE DE PAGO", 52.13, 221 + offset, 200, 7.48);
      for (const [label, x, width, align] of [
        ["Forma de Pago", 52.13, 160, "left"],
        ["Moneda", 250.04, 65, "left"],
        ["Importe", 326, 117.9, "right"],
        ["Cotiz.", 452, 90.84, "right"],
      ] as const)
        fitText(page, regular, label, x, 232 + offset, width, 7.2, align);
      receipt.payments.forEach((p, i) => {
        const top = 243 + i * 9.5 + offset;
        fitText(page, regular, p.method, 52.13, top, 185, 7.2);
        fitText(page, regular, p.currency, 250.04, top, 65, 7.2);
        fitText(
          page,
          regular,
          decimalDisplay(p.amount),
          326,
          top,
          117.9,
          7.2,
          "right",
        );
        fitText(
          page,
          regular,
          decimalDisplay(p.exchangeRate, 2, 6),
          452,
          top,
          90.84,
          7.2,
          "right",
        );
      });
    } else {
      fitText(
        page,
        regular,
        receipt.paymentMethod,
        52.13,
        267.43 + offset,
        160,
        7.48,
      );
      fitText(
        page,
        regular,
        receipt.currency,
        250.04,
        267.43 + offset,
        65,
        7.48,
      );
      fitText(
        page,
        regular,
        decimalDisplay(receipt.amount),
        326,
        267.43 + offset,
        117.9,
        7.48,
        "right",
      );
      fitText(
        page,
        regular,
        decimalDisplay(receipt.exchangeRate, 2, 6),
        452,
        267.43 + offset,
        90.84,
        7.48,
        "right",
      );
    }
  }
  doc.setTitle(`Recibo ${receiptNumber(receipt.number)} - STG Turismo`);
  doc.setAuthor("STG Turismo");
  doc.setSubject("Recibo de pago");
  doc.setCreationDate(new Date(receipt.createdAt));
  doc.setModificationDate(new Date(receipt.createdAt));
  return doc.save();
}
