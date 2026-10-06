import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { type QuotationRecord, returnLegs } from "@/features/quotations/domain";
import {
  decimalDisplay,
  issuedDate,
  receiptNumber,
  travelDateDisplay,
} from "@/features/receipts/domain";

const W = 595.28,
  H = 841.89,
  M = 28,
  CW = W - M * 2,
  BOTTOM = 770;
const ink = rgb(0.035, 0.1, 0.2),
  muted = rgb(0.39, 0.44, 0.54),
  gold = rgb(0.89, 0.55, 0),
  yellow = rgb(1, 0.78, 0.02),
  cream = rgb(0.987, 0.98, 0.954),
  border = rgb(0.94, 0.89, 0.78);
let logoBytes: Promise<Buffer> | undefined;
type Cell = { label: string; value: string };

export async function renderQuotationPdf(q: QuotationRecord) {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `Cotización ${q.number ? receiptNumber(q.number) : "BORRADOR"} - STG Turismo`,
  );
  doc.setAuthor("STG Turismo");
  doc.setCreationDate(new Date(q.createdAt));
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  logoBytes ??= readFile(path.join(process.cwd(), "public/logo-stg.png"));
  const logo = await doc.embedPng(await logoBytes);
  let page: PDFPage,
    y = M;
  let pendingHeading: { label: string; detail: string } | null = null;
  function write(
    value: string,
    x: number,
    top: number,
    size = 11,
    font = regular,
    color = ink,
  ) {
    page.drawText(value, { x, y: H - top - size, size, font, color });
  }
  function rect(
    x: number,
    top: number,
    width: number,
    height: number,
    color = cream,
  ) {
    page.drawRectangle({
      x,
      y: H - top - height,
      width,
      height,
      color,
      borderColor: border,
      borderWidth: 0.35,
    });
  }
  function line(x: number, top: number, x2: number, color = border) {
    page.drawLine({
      start: { x, y: H - top },
      end: { x: x2, y: H - top },
      thickness: 0.6,
      color,
    });
  }
  function wrap(
    value: string,
    width: number,
    size = 11,
    font: PDFFont = regular,
  ): string[] {
    // Split long unbroken words as well as paragraphs; never clip client-supplied text.
    const result: string[] = [];
    for (const paragraph of value.replace(/\r/g, "").split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          font.widthOfTextAtSize(current ? `${current} ${word}` : word, size) <=
          width
        ) {
          current = current ? `${current} ${word}` : word;
        } else {
          if (current) result.push(current);
          current = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(current + ch, size) > width && current) {
              result.push(current);
              current = "";
            }
            current += ch;
          }
        }
      }
      result.push(current);
    }
    return result;
  }
  function lines(
    values: string[],
    x: number,
    top: number,
    size = 11,
    font = regular,
    color = ink,
  ) {
    values.forEach((v, i) => {
      write(v, x, top + i * (size + 3), size, font, color);
    });
  }
  function newPage(continued = false) {
    page = doc.addPage([W, H]);
    page.drawImage(logo, { x: M, y: H - M - 43, width: 86, height: 43 });
    write("STG TURISMO", M + 100, M + 5, 20, bold);
    write("VIAJES A TU MEDIDA", M + 101, M + 28, 9.5, bold, muted);
    const label = q.number
      ? `COTIZACIÓN N° ${receiptNumber(q.number)}`
      : "VISTA PREVIA · SIN EMITIR";
    write(label, W - M - bold.widthOfTextAtSize(label, 10), M + 14, 10, bold);
    const when = `Emitida: ${issuedDate(q.createdAt)} · Válida por ${q.data.validityHours} h`;
    write(
      when,
      W - M - regular.widthOfTextAtSize(when, 9),
      M + 29,
      9,
      regular,
      muted,
    );
    y = 92;
    write(
      continued ? "COTIZACIÓN DE VIAJE · CONTINUACIÓN" : "COTIZACIÓN DE VIAJE",
      M,
      y - 10,
      continued ? 18 : 23,
      bold,
    );
    y += 26;
  }
  function ensure(height: number) {
    if (y + height + (pendingHeading ? 17 : 0) > BOTTOM) newPage(true);
    if (pendingHeading) {
      const { label, detail } = pendingHeading;
      pendingHeading = null;
      write(label, M, y, 11, bold, gold);
      if (detail)
        write(
          detail,
          M + bold.widthOfTextAtSize(label, 11) + 7,
          y + 1,
          9.5,
          regular,
          muted,
        );
      y += 17;
    }
  }
  function heading(label: string, detail = "") {
    // Place the section title together with its first row on page breaks.
    pendingHeading = { label, detail };
  }
  function grid(cells: Cell[], columns: number, size = 11) {
    const width = CW / columns;
    for (let i = 0; i < cells.length; i += columns) {
      const row = cells.slice(i, i + columns);
      let wrapped = row.map((c) => wrap(c.value, width - 18, size));
      const fullHeight =
        Math.max(...wrapped.map((a) => a.length)) * (size + 3) + 22;
      ensure(Math.min(fullHeight, BOTTOM - 118));
      while (wrapped.some((a) => a.length)) {
        ensure(size + 25);
        const capacity = Math.max(
          1,
          Math.floor((BOTTOM - y - 22) / (size + 3)),
        );
        const chunk = wrapped.map((a) => a.slice(0, capacity));
        const height =
          Math.max(...chunk.map((a) => a.length)) * (size + 3) + 22;
        row.forEach((c, j) => {
          const x = M + j * width;
          rect(x, y, width, height);
          write(c.label, x + 9, y + 5, 8.6, bold, gold);
          lines(chunk[j], x + 9, y + 18, size);
        });
        y += height;
        wrapped = wrapped.map((a) => a.slice(capacity));
        if (wrapped.some((a) => a.length)) newPage(true);
      }
    }
    y += 8;
  }
  newPage();
  const d = q.data;
  rect(M, y, CW, 17, yellow);
  y += 17;
  const leftWidth = 326,
    rightWidth = CW - leftWidth;
  const name = wrap(
    `${d.passenger} · ${d.passengers} ${d.passengers === 1 ? "pasajero" : "pasajeros"}`,
    leftWidth - 24,
    15,
    bold,
  );
  const dates = `${travelDateDisplay(d.startDate)} al ${travelDateDisplay(d.endDate)}${d.lodging ? ` · ${d.nights} noches` : ""}`;
  const destinations = wrap(`Destino: ${d.destination}`, leftWidth - 24, 10.5);
  const heroHeight = 48 + name.length * 18 + destinations.length * 13.5;
  rect(M, y, CW, heroHeight);
  write("PASAJERO", M + 11, y + 9, 9, bold, muted);
  lines(name, M + 11, y + 24, 15, bold);
  const afterName = y + 24 + name.length * 18;
  write(dates, M + 11, afterName + 3, 11, bold, gold);
  lines(destinations, M + 11, afterName + 20, 10.5, regular, muted);
  const rx = M + leftWidth + 10;
  write("PRECIO TOTAL", rx, y + 9, 9, bold, muted);
  const price = `${d.currency} ${decimalDisplay(d.amount, 0, 2)}`;
  let priceSize = 26;
  while (bold.widthOfTextAtSize(price, priceSize) > rightWidth - 20)
    priceSize -= 0.5;
  write(price, rx, y + 27, priceSize, bold, gold);
  const rate =
    d.currency === "ARS"
      ? "Cotización: 1 ARS = ARS 1"
      : `Cotización: 1 USD = ARS ${decimalDisplay(d.exchangeRate, 0, 6)}`;
  lines(wrap(rate, rightWidth - 20, 9.5), rx, y + 61, 9.5, regular, muted);
  y += heroHeight + 12;
  heading("RESUMEN DEL VIAJE");
  grid(
    [
      { label: "RÉGIMEN DE PENSIÓN", value: d.board },
      {
        label: "TRANSPORTE",
        value: `${d.transport} · ${d.roundTrip ? "Ida y vuelta" : "Solo ida"}`,
      },
      { label: "HOSPEDAJE", value: d.lodging ? "Incluido" : "Sin hospedaje" },
      {
        label: "ASISTENCIA AL VIAJERO",
        value: d.assistance ? `Sí · ${d.assistanceName}` : "No incluida",
      },
      { label: "TRASLADOS", value: d.transfers ? "Incluidos" : "No incluidos" },
      {
        label: "EXCURSIONES",
        value: d.excursions
          ? "Incluidas · ver detalle"
          : "Sin excursiones incluidas",
      },
    ],
    3,
    10,
  );
  heading(
    "TRANSPORTE",
    `${d.transport.toLowerCase()} · ${d.roundTrip ? "ida y vuelta" : "solo ida"}`,
  );
  const allLegs = [
    ...d.legs.map((l) => ({ ...l, direction: "IDA" })),
    ...(d.roundTrip
      ? returnLegs(d.legs).map((l) => ({ ...l, direction: "VUELTA" }))
      : []),
  ];
  grid(
    allLegs.map((l) => ({
      label: `${l.mode.toUpperCase()} · ${l.direction}`,
      value: `${l.from} a ${l.to}`,
    })),
    Math.min(3, allLegs.length),
    10.5,
  );
  heading(
    "HOSPEDAJE",
    d.lodging
      ? `${d.hotels.length} ${d.hotels.length === 1 ? "opción" : "opciones"} · ${d.nights} noches`
      : "sin hospedaje",
  );
  if (d.lodging) {
    d.hotels.forEach((hotel, i) => {
      const hotelText = wrap(
        `Opción ${i + 1} · ${hotel.name}`,
        288,
        11.5,
        bold,
      );
      const boardText = wrap(hotel.board, 106, 10);
      const priceText = wrap(
        `${d.currency} ${decimalDisplay(hotel.price, 0, 2)}`,
        103,
        12,
        bold,
      );
      const height =
        Math.max(
          hotelText.length * 14.5,
          boardText.length * 13,
          priceText.length * 15,
        ) + 16;
      ensure(height);
      rect(M, y, CW, height);
      lines(hotelText, M + 9, y + 7, 11.5, bold);
      lines(boardText, M + 303, y + 8, 10, regular, muted);
      lines(priceText, M + 427, y + 7, 12, bold, gold);
      y += height;
    });
    y += 5;
    ensure(22);
    write(
      "Precios totales alternativos según hospedaje; no se suman entre sí.",
      M + 2,
      y,
      8,
      regular,
      muted,
    );
    y += 19;
  } else {
    ensure(28);
    write("Esta cotización no incluye hospedaje.", M + 9, y, 11);
    y += 28;
  }
  heading("EQUIPAJE Y SERVICIOS");
  grid(
    [
      {
        label: "EQUIPAJE",
        value: `Carry-on: ${d.carryOn} piezas\nBodega: ${d.checkedBags} piezas${d.baggageNotes ? `\n${d.baggageNotes}` : ""}`,
      },
      {
        label: "ASISTENCIA AL VIAJERO",
        value: d.assistance
          ? `Incluida · ${d.assistanceName}${d.assistanceNotes ? `\n${d.assistanceNotes}` : ""}`
          : "Sin asistencia al viajero incluida.",
      },
      {
        label: "TRASLADOS",
        value: d.transfers
          ? `Incluidos.${d.transferNotes ? `\n${d.transferNotes}` : ""}`
          : "Traslados no incluidos.",
      },
      {
        label: "EXCURSIONES",
        value: d.excursions ? d.excursionDetails : "Sin excursiones incluidas.",
      },
    ],
    2,
    10,
  );
  const disclaimer = wrap(
    "IMPORTANTE · Valores sujetos a disponibilidad y reconfirmación al momento de la reserva. La cotización puede variar por cambios de tarifa, tipo de cambio o disponibilidad de servicios.",
    CW - 4,
    8.5,
  );
  ensure(disclaimer.length * 11.5 + 15);
  lines(disclaimer, M + 2, y, 8.5, regular, muted);
  y += disclaimer.length * 11.5 + 14;
  const noteLines = wrap(
    d.notes || "Sin aclaraciones adicionales.",
    CW - 24,
    11,
  );
  let remaining = noteLines;
  while (remaining.length) {
    ensure(88);
    rect(M, y, CW, 23, yellow);
    write("ACLARACIONES", M + 10, y + 5, 11, bold);
    y += 23;
    const available = Math.max(1, Math.floor((BOTTOM - y - 24) / 14));
    const chunk = remaining.slice(0, available);
    remaining = remaining.slice(available);
    const height = Math.max(65, chunk.length * 14 + 24);
    rect(M, y, CW, height);
    lines(chunk, M + 12, y + 12, 11, regular, muted);
    y += height;
    if (remaining.length) newPage(true);
  }
  doc.getPages().forEach((p, i) => {
    page = p;
    line(M, 787, W - M, yellow);
    write("STG TURISMO", M + 2, 796, 13, bold, gold);
    write(
      "Tu viaje, claro desde el primer momento",
      M + 2,
      813,
      9,
      regular,
      muted,
    );
    write("2615458242", 286, 801, 10, bold, muted);
    write("stg-turismo.vercel.app", 408, 801, 10, regular, muted);
    if (doc.getPageCount() > 1)
      write(
        `${i + 1} / ${doc.getPageCount()}`,
        W - M - 22,
        820,
        8,
        regular,
        muted,
      );
  });
  return doc.save();
}
