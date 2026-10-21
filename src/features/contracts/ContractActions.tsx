"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import { type ContractRecord, contractFilename } from "./domain";

export function ContractActions({ contract }: { contract: ContractRecord }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const url = useRef("");
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  async function action(open: boolean) {
    const tab = open ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    setBusy(true);
    setError("");
    try {
      if (!url.current) {
        const response = await authenticatedFetch(
          `/api/contracts/${contract.id}/pdf`,
        );
        url.current = URL.createObjectURL(await response.blob());
      }
      if (open) {
        if (!tab)
          throw new Error("Permití ventanas emergentes o descargá el PDF.");
        tab.location.href = url.current;
      } else {
        const a = document.createElement("a");
        a.href = url.current;
        a.download = contractFilename(contract);
        a.click();
      }
    } catch (e) {
      tab?.close();
      setError(
        e instanceof Error ? e.message : "No se pudo abrir el contrato.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void action(true)}
        >
          Abrir / imprimir
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void action(false)}
        >
          {busy ? "Cargando…" : "Descargar PDF"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
