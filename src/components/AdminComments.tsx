import { Edit3, Save, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { passengerComments } from "../data/site";
import {
  deleteComment,
  fetchComments,
  isSupabaseConfigured,
  saveComment,
} from "../lib/supabase";
import type { Comment } from "../types";

const blank: Comment = { name: "", trip: "", text: "" };
const key = "stg-comments";

export function useComments() {
  const [comments, setComments] = useState<Comment[]>(
    passengerComments.map((item, index) => ({
      ...item,
      id: `example-${index}`,
    })),
  );
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setComments(JSON.parse(stored));
    } catch {
      /* Keep the public initial content if this browser has no usable cache. */
    }
    setHydrated(true);
  }, []);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void fetchComments()
      .then((remote) => {
        if (!active) return;
        setComments((current) => [
          ...current.filter(
            (item) =>
              item.source !== "supabase" &&
              !remote.some((row) => row.id === item.id),
          ),
          ...remote,
        ]);
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudieron sincronizar los comentarios. Comprueba la conexion y ejecuta la migracion de comentarios en Supabase.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(comments));
    } catch {
      setError("No se pudieron guardar los comentarios en este dispositivo.");
    }
  }, [comments, hydrated]);
  return { comments, setComments, error };
}

export function AdminComments({
  comments,
  onChange,
  connected,
  syncError,
}: {
  comments: Comment[];
  onChange: (items: Comment[]) => void;
  connected: boolean;
  syncError: string;
}) {
  const [draft, setDraft] = useState<Comment>(blank);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (draft.source === "supabase" && !connected)
        throw new Error(
          "Conecta el admin de Supabase para editar este comentario publicado.",
        );
      let next = {
        ...draft,
        id: draft.id || crypto.randomUUID(),
        name: draft.name.trim(),
        trip: draft.trip.trim(),
        text: draft.text.trim(),
        source: "local" as "local" | "supabase",
      };
      if (!next.name || !next.trip || !next.text)
        throw new Error("Completa el nombre, viaje y comentario.");
      if (connected) next = await saveComment(next);
      onChange(
        comments.some((item) => item.id === next.id)
          ? comments.map((item) => (item.id === next.id ? next : item))
          : [next, ...comments],
      );
      setDraft(blank);
      setStatus(
        connected
          ? "Comentario publicado."
          : "Comentario guardado solo en este dispositivo.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Comment) {
    setBusy(true);
    try {
      if (item.source === "supabase") {
        if (!connected)
          throw new Error(
            "Conecta el admin de Supabase para borrar este comentario publicado.",
          );
        if (!item.id)
          throw new Error("El comentario no tiene un identificador válido.");
        await deleteComment(item.id);
      }
      onChange(comments.filter((row) => row.id !== item.id));
      if (draft.id === item.id) setDraft(blank);
      setDeleting(null);
      setStatus("Comentario eliminado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo borrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
      aria-labelledby="comments-title"
    >
      <h2 id="comments-title" className="text-2xl font-black text-foreground">
        Comentarios de pasajeros
      </h2>
      <p className="mt-2 text-sm text-muted">
        Publica los testimonios recibidos por correo con permiso de sus autores.
      </p>
      {(status || syncError) && (
        <p role="status" className="mt-3 text-sm text-muted">
          {status || syncError}
        </p>
      )}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form
          id="admin-comment-form"
          onSubmit={submit}
          className="surface-card grid scroll-mt-28 gap-4 p-5"
        >
          <h3 className="font-bold">
            {draft.id ? "Editar comentario" : "Nuevo comentario"}
          </h3>
          <label className="grid gap-2 text-sm font-bold">
            Nombre del pasajero
            <input
              className="admin-input"
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Viaje del pasajero
            <input
              className="admin-input"
              required
              maxLength={160}
              value={draft.trip}
              onChange={(e) => setDraft({ ...draft, trip: e.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Comentario
            <textarea
              className="admin-input min-h-32"
              required
              maxLength={2000}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn-primary">
              <Save size={18} />
              {busy ? "Guardando..." : "Guardar comentario"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDraft(blank)}
            >
              Cancelar
            </button>
          </div>
        </form>
        <div className="grid gap-4">
          {comments.length === 0 && (
            <p className="text-muted">Todavia no hay comentarios.</p>
          )}
          {comments.map((item) => (
            <article key={item.id} className="surface-card p-5">
              <p className="font-bold">
                {item.name}{" "}
                <span className="font-normal text-muted">· {item.trip}</span>
              </p>
              <p className="mt-3 whitespace-pre-wrap text-muted">{item.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost p-3"
                  title="Editar comentario"
                  aria-label={`Editar comentario de ${item.name}`}
                  onClick={() => {
                    setDraft(item);
                    document
                      .getElementById("admin-comment-form")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Edit3 size={18} />
                </button>
                <button
                  type="button"
                  className="btn-ghost p-3"
                  title="Borrar comentario"
                  aria-label={`Borrar comentario de ${item.name}`}
                  onClick={() => {
                    if (item.id) setDeleting(item.id);
                  }}
                >
                  <Trash2 size={18} />
                </button>
                {deleting === item.id && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      className="btn-danger"
                      onClick={() => void remove(item)}
                    >
                      Confirmar borrado
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDeleting(null)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
