import { mkdir, writeFile } from "node:fs/promises";
import { renderContractPdf } from "../src/server/contracts/pdf";
import { exampleContract, maximumContract } from "../tests/contract-fixture";

const output = ".artifacts/contracts";
await mkdir(output, { recursive: true });
const data = exampleContract();
const record = {
  id: "sample",
  number: 1,
  version: 1,
  previousId: null,
  createdAt: new Date().toISOString(),
  data,
};
await writeFile(
  `${output}/contrato-ejemplo.pdf`,
  await renderContractPdf(record),
);
await writeFile(
  `${output}/contrato-extenso.pdf`,
  await renderContractPdf({
    ...record,
    version: 2,
    data: maximumContract(),
  }),
);
console.log(`Ejemplos A4 en ${output}; no se guardaron contratos en la base.`);
