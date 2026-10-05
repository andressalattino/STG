"use client";
import {
  Copy,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest, authenticatedFetch } from "@/lib/api";
import { type ReceiptRecord, receiptFilename, receiptNumber } from "./domain";

export function ReceiptActions({
  receipt,
  prominent = false,
}: {
  receipt: ReceiptRecord;
  prominent?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareLink, setShareLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const blobUrl = useRef("");
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(
    () => () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (showShare) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showShare]);
  async function loadFile() {
    if (file) return file;
    const response = await authenticatedFetch(
      `/api/receipts/${receipt.id}/pdf`,
    );
    const result = new File([await response.blob()], receiptFilename(receipt), {
      type: "application/pdf",
    });
    const nextUrl = URL.createObjectURL(result);
    blobUrl.current = nextUrl;
    setUrl(nextUrl);
    setFile(result);
    return result;
  }
  async function action(kind: "open" | "download" | "share") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const tab = kind === "open" ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    try {
      const loaded = await loadFile();
      if (kind === "open") {
        if (tab) tab.location.href = blobUrl.current;
        else
          throw new Error(
            "El navegador bloqueó la ventana. Permití ventanas emergentes o descargá el PDF.",
          );
      }
      if (kind === "download") {
        const anchor = document.createElement("a");
        anchor.href = blobUrl.current;
        anchor.download = loaded.name;
        anchor.click();
      }
      if (kind === "share") setShowShare(true);
    } catch (failure) {
      tab?.close();
      setError(
        failure instanceof Error ? failure.message : "No se pudo abrir el PDF.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function nativeShare() {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: `Recibo ${receiptNumber(receipt.number)} - STG`,
      });
    } catch (failure) {
      if (failure instanceof Error && failure.name !== "AbortError")
        setError("No se pudo compartir. Descargá el PDF para adjuntarlo.");
    }
  }
  async function createLink() {
    setBusy(true);
    setError("");
    try {
      setShareLink(
        await apiRequest(`/api/receipts/${receipt.id}/share`, {
          method: "POST",
        }),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo crear el enlace.",
      );
    } finally {
      setBusy(false);
    }
  }
  const message = `Hola, te enviamos el recibo N.º ${receiptNumber(receipt.number)} de STG Turismo. ${shareLink?.url ?? ""}`;
  const canShare =
    typeof navigator !== "undefined" &&
    file &&
    navigator.canShare?.({ files: [file] });
  return (
    <div className={prominent ? "mt-4" : ""}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn-ghost px-3 py-2"
          onClick={() => void action("open")}
          aria-label={`Abrir o imprimir recibo ${receiptNumber(receipt.number)}`}
        >
          <FileText size={16} />
          {prominent ? "Abrir / imprimir" : "PDF"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost px-3 py-2"
          onClick={() => void action("download")}
          aria-label={`Descargar recibo ${receiptNumber(receipt.number)}`}
        >
          <Download size={16} />
          {prominent && "Descargar"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost px-3 py-2"
          onClick={() => void action("share")}
          aria-label={`Compartir recibo ${receiptNumber(receipt.number)}`}
        >
          <Share2 size={16} />
          {prominent && "Compartir"}
        </button>
      </div>
      {error && !showShare && (
        <p
          role="alert"
          className="mt-2 max-w-xs whitespace-normal text-xs text-danger"
        >
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setShowShare(false)}
        onClose={() => setShowShare(false)}
        className="receipt-dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Recibo {receiptNumber(receipt.number)}</p>
            <h2 className="mt-2 text-xl font-bold">Enviar el comprobante</h2>
          </div>
          <button
            type="button"
            className="btn-ghost p-2"
            aria-label="Cerrar compartir"
            onClick={() => setShowShare(false)}
          >
            <X size={18} />
          </button>
        </div>
        <p className="my-4 text-sm leading-6 text-muted">
          Descargá el PDF para adjuntarlo por correo o WhatsApp. En dispositivos
          compatibles también podés compartir el archivo directamente.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={url} download={file?.name}>
            <Download size={17} />
            Descargar PDF
          </a>
          {canShare && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void nativeShare()}
            >
              <Share2 size={17} />
              Compartir archivo
            </button>
          )}
        </div>
        <div className="my-5 border-t border-line" />
        <p className="text-sm text-muted">
          También podés crear un enlace privado válido por 7 días. Cualquier
          persona que lo reciba podrá abrir este comprobante.
        </p>
        {!shareLink ? (
          <button
            type="button"
            className="btn-ghost mt-4"
            disabled={busy}
            onClick={() => void createLink()}
          >
            {busy ? "Creando enlace…" : "Crear enlace para enviar"}
          </button>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap gap-2">
              <a
                className="btn-primary"
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} />
                WhatsApp
              </a>
              <a
                className="btn-ghost"
                href={`mailto:?subject=${encodeURIComponent(`Recibo ${receiptNumber(receipt.number)} - STG Turismo`)}&body=${encodeURIComponent(message)}`}
              >
                <Mail size={17} />
                Correo
              </a>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(shareLink.url)
                    .then(() => setCopied(true))
                    .catch(() => setError("No se pudo copiar el enlace."));
                }}
              >
                <Copy size={17} />
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
            <p className="text-xs text-muted">
              Vence el{" "}
              {new Date(shareLink.expiresAt).toLocaleDateString("es-AR")}.
            </p>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </dialog>
    </div>
  );
}
