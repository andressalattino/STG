import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import {
  type ContractRecord,
  contractTotals,
  normalizeContractData,
} from "@/features/contracts/domain";
import {
  decimalDisplay,
  issuedDate,
  issuedTime,
  travelDateDisplay,
} from "@/features/receipts/domain";

const W = 595.28,
  H = 841.89,
  M = 22,
  CW = W - M * 2,
  CONTENT_END = 742;
const ink = rgb(0.035, 0.14, 0.22),
  blue = rgb(0.025, 0.4, 0.54),
  pale = rgb(0.94, 0.975, 0.99),
  border = rgb(0.65, 0.8, 0.86);
const overflow = () => new Error("CONTRACT_SINGLE_PAGE_OVERFLOW");
let logoBytes: Promise<Buffer> | undefined;
type Cell = { value: string; label?: string; fraction?: number };

async function renderAtSize(contract: ContractRecord, size: number) {
  const data = normalizeContractData(contract.data);
  if (
    !data.passengers.length ||
    data.passengers.length > 6 ||
    data.hotels.length > 3
  )
    throw overflow();
  const doc = await PDFDocument.create();
  const label = contract.number
    ? `${String(contract.number).padStart(6, "0")} / versión ${contract.version}`
    : "BORRADOR - SIN EMITIR";
  doc.setTitle(`Contratos - ${label} - STG Turismo`);
  doc.setAuthor("STG Viajes y Turismo");
  doc.setCreationDate(new Date(contract.createdAt));
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  logoBytes ??= readFile(path.join(process.cwd(), "public/logo-stg.png"));
  const logo = await doc.embedPng(await logoBytes);
  const page = doc.addPage([W, H]);
  let y = 120;
  const leading = size + 1.5;
  function write(
    value: string,
    x: number,
    top: number,
    fontSize = size,
    font = regular,
    color = ink,
  ) {
    page.drawText(value, {
      x,
      y: H - top - fontSize,
      size: fontSize,
      font,
      color,
    });
  }
  function wrap(
    value: string,
    width: number,
    fontSize = size,
    font: PDFFont = regular,
  ) {
    const lines: string[] = [];
    for (const paragraph of value.replace(/\r/g, "").split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          font.widthOfTextAtSize(
            current ? `${current} ${word}` : word,
            fontSize,
          ) <= width
        )
          current = current ? `${current} ${word}` : word;
        else {
          if (current) lines.push(current);
          current = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(current + ch, fontSize) > width) {
              lines.push(current);
              current = ch;
            } else current += ch;
          }
        }
      }
      lines.push(current);
    }
    return lines.length ? lines : [""];
  }
  function ensure(height: number) {
    if (y + height > CONTENT_END) throw overflow();
  }
  function rect(
    x: number,
    top: number,
    width: number,
    height: number,
    fill = pale,
  ) {
    page.drawRectangle({
      x,
      y: H - top - height,
      width,
      height,
      color: fill,
      borderColor: border,
      borderWidth: 0.4,
    });
  }
  function line(
    x: number,
    top: number,
    to: number,
    color = border,
    thickness = 0.5,
  ) {
    page.drawLine({
      start: { x, y: H - top },
      end: { x: to, y: H - top },
      color,
      thickness,
    });
  }
  function section(title: string) {
    ensure(24);
    y += 5;
    rect(M, y, CW, 17, blue);
    write(title.toUpperCase(), M + 6, y + 3, 9, bold, rgb(1, 1, 1));
    y += 17;
  }
  function row(cells: Cell[], heading = false) {
    const fontSize = heading ? 8 : size,
      font = heading ? bold : regular;
    const widths = cells.map((c) => CW * (c.fraction ?? 1 / cells.length));
    const lines = cells.map((c, i) =>
      wrap(c.value, widths[i] - 12, fontSize, font),
    );
    const labels = cells.map((c, i) =>
      c.label ? wrap(c.label, widths[i] - 12, 7.5, bold) : [],
    );
    const labelHeight = Math.max(...labels.map((l) => l.length)) * 9;
    const lineHeight = heading ? 9.5 : leading;
    const height =
      9 + labelHeight + Math.max(...lines.map((l) => l.length)) * lineHeight;
    ensure(height);
    let x = M;
    cells.forEach((_cell, i) => {
      rect(x, y, widths[i], height);
      labels[i].forEach((text, n) => {
        write(text, x + 6, y + 4 + n * 9, 7.5, bold, blue);
      });
      lines[i].forEach((text, n) => {
        write(
          text,
          x + 6,
          y + 4 + labelHeight + n * lineHeight,
          fontSize,
          font,
        );
      });
      x += widths[i];
    });
    y += height;
  }
  const logoSize = logo.scale(Math.min(105 / logo.width, 57 / logo.height));
  page.drawImage(logo, {
    x: M,
    y: H - M - logoSize.height,
    width: logoSize.width,
    height: logoSize.height,
  });
  write("Empresa de Viaje y Turismo", M + 119, 24, 9.5, bold, blue);
  write("De Lorena Mariana Dalmasso", M + 119, 40, 8.5);
  write("Legajo: 11270   Expediente: 910/01", M + 119, 54, 8);
  write("CONTRATOS", W - M - 145, 24, 18, bold, blue);
  write(label, W - M - 145, 48, 8.5, bold);
  write(`Mendoza, ${issuedDate(contract.createdAt)}`, W - M - 145, 62, 8.5);
  write(`${issuedTime(contract.createdAt)} h - Argentina`, W - M - 145, 75, 8);
  write(
    "Tel.: 261-5458242 / 2617576755   |   stglorena@hotmail.com",
    M,
    87,
    8.5,
    regular,
    blue,
  );
  write(
    "Las Heras 418 - Galería del Sol - Local 28 - Ciudad de Mendoza   |   stg-turismo.vercel.app",
    M,
    100,
    8,
  );
  line(M, 114, W - M, rgb(1, 0.78, 0.02), 2.5);

  section("Datos del viaje");
  row([
    { label: "Tour / destino", value: data.destination, fraction: 0.7 },
    { label: "N.º de reserva", value: data.reservationNumber, fraction: 0.3 },
  ]);
  row([
    {
      label: "Salida - fecha, hora y lugar",
      value: `${travelDateDisplay(data.departure.date)}${data.departure.time ? ` - ${data.departure.time} h` : ""}\n${data.departure.place}`,
    },
    {
      label: "Regreso - fecha, hora y lugar",
      value: `${travelDateDisplay(data.return.date)}${data.return.time ? ` - ${data.return.time} h` : ""}\n${data.return.place}`,
    },
  ]);
  section("Alojamiento, habitaciones y comidas");
  const hotelWidths = [0.27, 0.23, 0.29, 0.21];
  row(
    [
      "Hotel / categoría",
      "Ingreso / egreso",
      "Habitaciones",
      "Régimen de comidas",
    ].map((value, i) => ({ value, fraction: hotelWidths[i] })),
    true,
  );
  for (let i = 0; i < 3; i++) {
    const hotel = data.hotels[i];
    if (!hotel) {
      row(
        ["", "\n", "", ""].map((value, n) => ({
          value,
          fraction: hotelWidths[n],
        })),
      );
      continue;
    }
    row([
      {
        value: `${hotel.name}${hotel.stars ? ` (${hotel.stars} estrellas)` : ""}`,
        fraction: hotelWidths[0],
      },
      {
        value: `${travelDateDisplay(hotel.checkIn)}\n${travelDateDisplay(hotel.checkOut)}`,
        fraction: hotelWidths[1],
      },
      {
        value: hotel.rooms.map((r) => `${r.quantity} ${r.type}`).join(" / "),
        fraction: hotelWidths[2],
      },
      { value: hotel.meals[0] || "Sin comidas", fraction: hotelWidths[3] },
    ]);
  }
  section("Transporte y excursiones");
  row([
    {
      label: "Transporte",
      value: data.transport.length
        ? data.transport
            .map(
              (t, i) =>
                `${i + 1}. ${t.type}${t.type === "Bus" ? ` - ${t.seat}` : ""}${t.description ? `: ${t.description}` : ""}`,
            )
            .join("\n")
        : "No incluido.",
    },
    {
      label: "Excursiones",
      value: data.excursions.length
        ? data.excursions.map((e, i) => `${i + 1}. ${e.description}`).join("\n")
        : "No incluidas.",
    },
  ]);
  const totals = contractTotals(data),
    money = (amount: string) => `${data.currency} ${decimalDisplay(amount)}`;
  section("Precio y reserva");
  row([
    { label: "Efectivo (total)", value: money(totals.total) },
    { label: "Valor del pasaje / persona", value: money(data.unitPrice) },
    { label: "Seña", value: money(data.deposit) },
    { label: "Resto", value: money(totals.remaining) },
  ]);
  if (data.currency === "USD")
    row([
      {
        value: `Cotización: ARS ${decimalDisplay(data.exchangeRate)} por USD (${data.rateSource === "manual" ? "manual" : "oficial de venta"}) - Equivalente total: ARS ${decimalDisplay(totals.totalArs)}`,
      },
    ]);
  section(`Datos de los pasajeros (${data.passengers.length} / 6)`);
  const passengerWidths = [0.06, 0.32, 0.17, 0.19, 0.26];
  row(
    ["N°", "Nombre y apellido", "DNI", "Nacimiento", "Teléfono"].map(
      (value, i) => ({ value, fraction: passengerWidths[i] }),
    ),
    true,
  );
  for (let i = 0; i < 6; i++) {
    const p = data.passengers[i];
    row(
      [
        String(i + 1).padStart(2, "0"),
        p?.name ?? "",
        p?.dni ?? "",
        p ? travelDateDisplay(p.birthDate) : "",
        p ? p.phone || "-" : "",
      ].map((value, n) => ({ value, fraction: passengerWidths[n] })),
    );
  }
  if (data.notes) {
    y += 5;
    row([{ label: "Observaciones", value: data.notes }]);
  }
  line(M + 12, 783, M + CW * 0.46, ink);
  line(M + CW * 0.54, 783, W - M - 12, ink);
  write("Firma del cliente", M + 68, 793, 9, regular, blue);
  write("Firma del vendedor", M + CW * 0.54 + 43, 793, 9, regular, blue);
  line(M, H - 25, W - M);
  write(`STG Viajes y Turismo - ${label}`, M, H - 20, 7, regular, blue);
  write("1 / 1 - A4", W - M - 43, H - 20, 7, regular, blue);
  return doc.save();
}

export async function renderContractPdf(contract: ContractRecord) {
  for (const size of [9.5, 9, 8.5]) {
    try {
      return await renderAtSize(contract, size);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "CONTRACT_SINGLE_PAGE_OVERFLOW"
      )
        throw error;
    }
  }
  throw overflow();
}
