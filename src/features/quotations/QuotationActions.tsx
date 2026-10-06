"use client";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import { type QuotationRecord, quotationFilename } from "./domain";
export function QuotationActions({
  quotation,
}: {
  quotation: QuotationRecord;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const url = useRef("");
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  async function action(open: boolean) {
    setBusy(true);
    setError("");
    const tab = open ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    try {
      let loaded = file;
      if (!loaded) {
        const response = await authenticatedFetch(
          `/api/quotations/${quotation.id}/pdf`,
        );
        loaded = new File(
          [await response.blob()],
          quotationFilename(quotation),
          { type: "application/pdf" },
        );
        url.current = URL.createObjectURL(loaded);
        setFile(loaded);
      }
      if (open) {
        if (tab) tab.location.href = url.current;
        else throw new Error("Permití ventanas emergentes o descargá el PDF.");
      } else {
        const a = document.createElement("a");
        a.href = url.current;
        a.download = loaded.name;
        a.click();
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "No se pudo abrir el PDF.");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: "Cotización de viaje - STG Turismo",
      });
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError")
        setError("Descargá el PDF para adjuntarlo por WhatsApp o correo.");
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
        {file && navigator.canShare?.({ files: [file] }) && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void share()}
          >
            Compartir archivo
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
