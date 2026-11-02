import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { receiptInputSchema } from "../src/features/receipts/domain";
import { renderReceiptPdf } from "../src/server/receipts/pdf";

const base = {
  requestId: randomUUID(),
  client: "Cliente de ejemplo",
  reservation: "00125",
  passengers: 2,
  travelDate: "2027-02-21",
  destination: "Bariloche",
  rateSource: "manual",
  payments: [
    { method: "Pesos", amount: "30000" },
    { method: "Dólares", amount: "10", exchangeRate: "1550" },
  ],
};
const dir = ".artifacts/receipt-payments";
await mkdir(dir, { recursive: true });
for (const [name, payments] of [
  ["recibo-pago-mixto", base.payments],
  [
    "recibo-cuatro-metodos",
    [
      ...base.payments,
      { method: "Tarjeta de crédito", amount: "5000" },
      { method: "Tarjeta de débito", amount: "1000" },
    ],
  ],
] as const) {
  const data = receiptInputSchema.parse({ ...base, payments });
  const pdf = await renderReceiptPdf({
    ...data,
    id: "sample",
    number: 1,
    createdAt: "2026-11-02T15:00:00Z",
    totalArs: data.amount,
    templateVersion: "v2-payments",
  });
  await writeFile(`${dir}/${name}.pdf`, pdf);
}
console.log(`Ejemplos con datos ficticios en ${dir}; no se emitieron recibos.`);
