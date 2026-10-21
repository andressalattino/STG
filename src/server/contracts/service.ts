import { createHash } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { getDb } from "@/db";
import { contractCounter, contractDocuments, contracts } from "@/db/schema";
import {
  type ContractInput,
  type ContractRecord,
  contractSearchTerm,
  normalizeContractData,
} from "@/features/contracts/domain";
import { HttpError } from "@/server/http";
import { renderContractPdf } from "./pdf";

export async function listContracts(
  db: ReturnType<typeof getDb>,
  input: { page: number; q: string },
) {
  const term = contractSearchTerm(input.q);
  const dniTerm = contractSearchTerm(input.q.replace(/[.\s-]/g, ""));
  const where = input.q
    ? or(
        ilike(contracts.passengerNames, term),
        ilike(contracts.passengerDnis, dniTerm),
        ilike(contracts.destination, term),
        sql`cast(${contracts.number} as text) = ${input.q.replace(/^0+/, "")}`,
      )
    : undefined;
  const newer = alias(contracts, "newer_contract");
  const [rows, [total]] = await Promise.all([
    db
      .select({
        contract: contracts,
        isLatest: notExists(
          db
            .select({ id: newer.id })
            .from(newer)
            .where(
              and(
                eq(newer.number, contracts.number),
                gt(newer.version, contracts.version),
              ),
            ),
        ),
      })
      .from(contracts)
      .where(where)
      .orderBy(desc(contracts.number), desc(contracts.version))
      .limit(20)
      .offset((input.page - 1) * 20),
    db.select({ value: count() }).from(contracts).where(where),
  ]);
  return {
    contracts: rows.map((row) => ({
      ...publicContract(row.contract),
      isLatest: row.isLatest,
    })),
    total: total.value,
    page: input.page,
    pageSize: 20,
  };
}

export function publicContract(
  row: typeof contracts.$inferSelect,
): ContractRecord {
  return {
    id: row.id,
    number: row.number,
    version: row.version,
    previousId: row.previousId,
    createdAt: row.createdAt.toISOString(),
    data: normalizeContractData(row.data),
  };
}
export async function issueContract(
  db: ReturnType<typeof getDb>,
  input: ContractInput,
  userId: string,
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ previousId: input.previousId, data: input.data }))
    .digest("hex");
  return db.transaction(async (tx) => {
    // A single lock protects independent numbering and concurrent revisions; no external calls occur here.
    const [counter] = await tx
      .select()
      .from(contractCounter)
      .where(eq(contractCounter.id, 1))
      .for("update");
    if (!counter)
      throw new HttpError(503, "Falta aplicar la migración de contratos.");
    const [existing] = await tx
      .select()
      .from(contracts)
      .where(eq(contracts.requestId, input.requestId))
      .limit(1);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new HttpError(409, "Este envío ya se guardó con otros datos.");
      return { contract: publicContract(existing), replayed: true };
    }
    let number = counter.nextNumber,
      version = 1;
    if (input.previousId) {
      const [previous] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, input.previousId))
        .limit(1);
      if (!previous)
        throw new HttpError(404, "No se encontró el contrato original.");
      const [latest] = await tx
        .select({ id: contracts.id })
        .from(contracts)
        .where(eq(contracts.number, previous.number))
        .orderBy(desc(contracts.version))
        .limit(1);
      if (latest.id !== previous.id)
        throw new HttpError(
          409,
          "Ya existe una versión más reciente. Abrila desde el historial para continuar.",
        );
      number = previous.number;
      version = previous.version + 1;
    }
    if (number > 999999 || version > 9999)
      throw new HttpError(
        409,
        "Se alcanzó el límite de numeración de contratos.",
      );
    const [row] = await tx
      .insert(contracts)
      .values({
        requestId: input.requestId,
        previousId: input.previousId,
        fingerprint,
        createdBy: userId,
        number,
        version,
        destination: input.data.destination,
        passengerNames: input.data.passengers.map((p) => p.name).join("\n"),
        passengerDnis: input.data.passengers.map((p) => p.dni).join("\n"),
        data: input.data,
        createdAt: new Date(),
        templateVersion: "v2",
      })
      .returning();
    const contract = publicContract(row);
    const content = Buffer.from(await renderContractPdf(contract));
    await tx.insert(contractDocuments).values({
      contractId: row.id,
      content,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    if (!input.previousId)
      await tx
        .update(contractCounter)
        .set({ nextNumber: sql`${contractCounter.nextNumber} + 1` })
        .where(eq(contractCounter.id, 1));
    return { contract, replayed: false };
  });
}
