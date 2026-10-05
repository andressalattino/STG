"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasAdminSession, signInAdmin, signOutAdmin } from "@/lib/supabase";
import { supabase } from "@/lib/supabase-client";

type SessionStatus = "checking" | "authenticated" | "anonymous" | "error";

export function useAdminSession() {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const generation = useRef(0);

  const checkSession = useCallback(async () => {
    const attempt = ++generation.current;
    setStatus("checking");
    try {
      const allowed = await hasAdminSession();
      if (attempt === generation.current) {
        setStatus(allowed ? "authenticated" : "anonymous");
      }
    } catch {
      if (attempt === generation.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        ++generation.current;
        setStatus("anonymous");
      }
    }).data.subscription;
    return () => {
      ++generation.current;
      subscription?.unsubscribe();
    };
  }, [checkSession]);

  async function login(email: string, password: string) {
    const attempt = ++generation.current;
    await signInAdmin(email, password);
    const allowed = await hasAdminSession();
    if (attempt !== generation.current) return;
    if (!allowed) {
      await signOutAdmin();
      throw new Error("Tu cuenta no tiene permisos de administrador.");
    }
    setStatus("authenticated");
  }

  async function logout() {
    ++generation.current;
    setStatus("anonymous");
    await signOutAdmin();
  }

  return {
    status,
    isAdmin: status === "authenticated",
    login,
    logout,
    checkSession,
  };
}
