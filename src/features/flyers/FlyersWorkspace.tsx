"use client";

import { Edit3, Plus, Printer, Save, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeleteConfirmation } from "@/components/DeleteConfirmation";
import { Field } from "@/components/site/shared";
import { FinanceHeader } from "@/features/finance/FinanceHeader";
import { apiRequest, authenticatedFetch } from "@/lib/api";
import {
  type FlyerData,
  type FlyerRecord,
  flyerDuration,
  flyerLimits,
  flyerSchema,
  hotelSlots,
} from "./domain";
import { type FlyerDraft, FlyerPreview } from "./FlyerPreview";
import "./flyers.css";

function makeDraft(data?: FlyerData): FlyerDraft {
  return {
    title: data?.title ?? "",
    days: data ? String(data.days) : "",
    nights: data ? String(data.nights) : "",
    transport: data?.transport ?? "",
    company: data?.company ?? "",
    hotels: hotelSlots.map(
      (slot) => data?.hotels[slot] ?? { name: "", date: "", price: "" },
    ),
  };
}

function hasHotelFields(hotel: FlyerDraft["hotels"][number]) {
  return Boolean(hotel.name.trim() || hotel.date || hotel.price.trim());
}

export function FlyersWorkspace({ onLogout }: { onLogout: () => void }) {
  const [draft, setDraft] = useState(() => makeDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [records, setRecords] = useState<FlyerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [libraryError, setLibraryError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [deleting, setDeleting] = useState<FlyerRecord | null>(null);
  const creationId = useRef<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  const validated = flyerSchema.safeParse({
    ...draft,
    days: draft.days === "" ? undefined : Number(draft.days),
    nights: draft.nights === "" ? undefined : Number(draft.nights),
    hotels: draft.hotels.map((hotel) => (hasHotelFields(hotel) ? hotel : null)),
  });

  useEffect(() => {
    void reload;
    const controller = new AbortController();
    const { signal } = controller;
    apiRequest<FlyerRecord[]>("/api/flyers", { signal })
      .then((items) => {
        if (!signal.aborted) setRecords(items);
      })
      .catch((failure: Error) => {
        if (!signal.aborted) setLibraryError(failure.message);
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  function openEditor(record?: FlyerRecord) {
    setEditingId(record?.id ?? null);
    setDraft(makeDraft(record?.data));
    setError("");
    setStatus("");
    creationId.current = null;
    titleInput.current?.focus();
  }

  function updateHotel(
    slot: number,
    field: keyof FlyerDraft["hotels"][number],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      hotels: current.hotels.map((hotel, index) =>
        index === slot ? { ...hotel, [field]: value } : hotel,
      ),
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading) return;
    setError("");
    setStatus("");
    if (!validated.success) {
      setError(validated.error.issues[0].message);
      return;
    }

    setBusy("save");
    try {
      const { data } = validated;
      if (!editingId) creationId.current ??= crypto.randomUUID();
      const saved = await apiRequest<FlyerRecord>(
        editingId ? `/api/flyers/${editingId}` : "/api/flyers",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(
            editingId ? data : { id: creationId.current, data },
          ),
        },
      );
      setRecords((items) => [
        saved,
        ...items.filter((item) => item.id !== saved.id),
      ]);
      setEditingId(saved.id);
      setDraft(makeDraft(saved.data));
      setStatus("Folleto guardado.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar el folleto.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(record: FlyerRecord) {
    setBusy("delete");
    setError("");
    setLibraryError("");
    setStatus("");
    try {
      await authenticatedFetch(`/api/flyers/${record.id}`, {
        method: "DELETE",
      });
      setRecords((items) => items.filter((item) => item.id !== record.id));
      if (editingId === record.id) {
        setEditingId(null);
        setDraft(makeDraft());
        creationId.current = null;
      }
      setStatus("Folleto eliminado.");
    } catch (failure) {
      setLibraryError(
        failure instanceof Error
          ? failure.message
          : "No se pudo eliminar el folleto.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceHeader
        title="Folletos"
        description="Prepará las opciones de un viaje y armá una hoja A4 con cuatro copias del folleto."
        onLogout={onLogout}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <form onSubmit={save} className="surface-card p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">
              {editingId ? "Editar folleto" : "Nuevo folleto"}
            </h2>
            <a
              className="text-sm font-bold text-stg-blue underline underline-offset-4"
              href="#folletos-guardados"
            >
              Ver guardados
            </a>
          </div>
          <fieldset disabled={busy !== null} className="grid min-w-0 gap-4">
            <Field label="Nombre del viaje">
              <input
                ref={titleInput}
                className="admin-input"
                required
                maxLength={flyerLimits.title}
                placeholder="Mar del Plata"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Días">
                <input
                  className="admin-input"
                  type="number"
                  required
                  min={1}
                  max={flyerLimits.duration}
                  placeholder="7"
                  value={draft.days}
                  onChange={(e) => setDraft({ ...draft, days: e.target.value })}
                />
              </Field>
              <Field label="Noches">
                <input
                  className="admin-input"
                  type="number"
                  required
                  min={0}
                  max={flyerLimits.duration}
                  placeholder="5"
                  value={draft.nights}
                  onChange={(e) =>
                    setDraft({ ...draft, nights: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de asiento">
                <select
                  className="admin-input"
                  required
                  value={draft.transport}
                  onChange={(e) =>
                    setDraft({ ...draft, transport: e.target.value })
                  }
                >
                  <option value="">Elegí una opción</option>
                  <option>Cama</option>
                  <option>Semicama</option>
                </select>
              </Field>
              <Field label="Empresa de transporte">
                <input
                  className="admin-input"
                  required
                  maxLength={flyerLimits.company}
                  placeholder="El Rayo"
                  value={draft.company}
                  onChange={(e) =>
                    setDraft({ ...draft, company: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-2 border-t border-line pt-4">
              <h3 className="font-black">Opciones de hotel</h3>
              <p className="mt-1 text-sm text-muted">
                Completá nombre, fecha y precio de cada opción que quieras
                ofrecer. Las filas vacías conservan su lugar.
              </p>
              <div className="mt-3 space-y-2">
                {hotelSlots.map((slot) => {
                  const hotel = draft.hotels[slot];
                  const required = hasHotelFields(hotel);
                  return (
                    <fieldset
                      key={slot}
                      className="grid min-w-0 gap-3 rounded-md border border-line bg-subtle px-3 pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,7rem)]"
                    >
                      <legend className="px-1 text-xs font-black text-muted">
                        Hotel 0{slot + 1}
                      </legend>
                      <Field label="Nombre">
                        <input
                          className="admin-input"
                          required={required}
                          maxLength={flyerLimits.hotel}
                          value={hotel.name}
                          onChange={(e) =>
                            updateHotel(slot, "name", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Fecha">
                        <input
                          className="admin-input min-w-0"
                          type="date"
                          required={required}
                          max="9999-12-31"
                          value={hotel.date}
                          onChange={(e) =>
                            updateHotel(slot, "date", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Precio (ARS)">
                        <input
                          className="admin-input"
                          inputMode="decimal"
                          required={required}
                          maxLength={12}
                          placeholder="150000"
                          value={hotel.price}
                          onChange={(e) =>
                            updateHotel(slot, "price", e.target.value)
                          }
                        />
                      </Field>
                    </fieldset>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || busy !== null}
              >
                <Save aria-hidden="true" size={17} />
                {busy === "save" ? "Guardando…" : "Guardar folleto"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openEditor()}
              >
                <Plus aria-hidden="true" size={17} /> Empezar otro
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            {status && (
              <p role="status" className="text-sm font-semibold">
                {status}
              </p>
            )}
          </fieldset>
        </form>
        <aside
          className="surface-card min-w-0 bg-subtle p-4 sm:p-5 lg:sticky lg:top-24"
          aria-labelledby="flyer-preview-title"
        >
          <div className="mx-auto grid max-w-[24rem] gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <h2 id="flyer-preview-title" className="font-black">
                Vista previa
              </h2>
              <p className="text-sm text-muted">4 copias · A4 vertical</p>
            </div>
            <FlyerPreview draft={draft} />
            <button
              type="button"
              className="btn-secondary"
              disabled={!validated.success}
              onClick={() => window.print()}
            >
              <Printer aria-hidden="true" size={18} /> Imprimir / Guardar PDF
            </button>
            <p className="text-sm text-muted">
              {validated.success
                ? "Podés elegir «Guardar como PDF» en el diálogo de impresión."
                : "Completá los datos del viaje y las opciones de hotel que hayas empezado para imprimir."}
            </p>
          </div>
        </aside>
      </div>
      <section
        id="folletos-guardados"
        className="surface-card mt-6 scroll-mt-28 p-4 sm:p-6"
        aria-labelledby="flyer-library-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="flyer-library-title" className="text-xl font-black">
            Folletos guardados
          </h2>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || busy !== null}
            onClick={() => {
              setLibraryError("");
              setLoading(true);
              setReload((attempt) => attempt + 1);
            }}
          >
            Actualizar lista
          </button>
        </div>
        {loading && (
          <p className="mt-4 text-sm text-muted" role="status">
            Cargando folletos…
          </p>
        )}
        {libraryError && (
          <p className="mt-4 text-sm font-semibold text-danger" role="alert">
            {libraryError}
          </p>
        )}
        {!loading && !libraryError && !records.length && (
          <p className="mt-4 text-sm text-muted">
            Todavía no hay folletos guardados.
          </p>
        )}
        <ul className="mt-2 divide-y divide-line">
          {records.map((record) => (
            <li
              key={record.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-bold">{record.data.title}</p>
                <p className="text-sm text-muted">
                  {flyerDuration(record.data.days, record.data.nights)} ·{" "}
                  {record.data.company}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy !== null || loading}
                  onClick={() => openEditor(record)}
                >
                  <Edit3 aria-hidden="true" size={16} /> Editar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy !== null || loading}
                  onClick={() => setDeleting(record)}
                >
                  <Trash2 aria-hidden="true" size={16} /> Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {deleting && (
        <DeleteConfirmation
          message={`¿Querés eliminar el folleto «${deleting.data.title}»?`}
          onResolve={(confirmed) => {
            if (confirmed) void remove(deleting);
            setDeleting(null);
          }}
        />
      )}
      {validated.success &&
        createPortal(
          <div className="flyer-print-sheet">
            {hotelSlots.map((copy) => (
              <FlyerPreview key={copy} draft={draft} />
            ))}
          </div>,
          document.body,
        )}
    </section>
  );
}
