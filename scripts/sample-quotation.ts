import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderQuotationPdf } from "../src/server/quotations/pdf";
import { exampleQuotation } from "../tests/quotation-fixture";

const output = process.env.STG_TEST_OUTPUT_DIR || ".artifacts";
await mkdir(output, { recursive: true });
const data = exampleQuotation();
const record = {
  id: "example",
  number: 184,
  createdAt: "2026-10-06T15:00:00Z",
  expiresAt: "2026-10-09T15:00:00Z",
  data,
};
await writeFile(
  path.join(output, "cotizacion-ejemplo.pdf"),
  await renderQuotationPdf(record),
);
await writeFile(
  path.join(output, "cotizacion-extensa.pdf"),
  await renderQuotationPdf({
    ...record,
    data: {
      ...data,
      roundTrip: true,
      notes:
        "Condición especial con texto extenso para comprobar los saltos de página y la lectura completa. ".repeat(
          20,
        ),
    },
  }),
);
console.log(
  "PDF de ejemplo y prueba extensa generados sin guardar registros en la base.",
);
