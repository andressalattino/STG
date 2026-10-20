"use client";

import { useEffect, useState } from "react";
import { passengerComments } from "@/data/site";
import { fetchComments, isSupabaseConfigured } from "@/lib/supabase";
import type { Comment } from "@/types";

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
