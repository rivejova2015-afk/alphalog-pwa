"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

/**
 * RealtimeRefresher
 * FIX: consolidado de 25 canales individuales → 1 canal con wildcard schema.
 * Antes: 25 WebSocket subscriptions simultáneas por sesión.
 * Ahora: 1 canal, pausa automática cuando el tab está en background.
 */
export default function RealtimeRefresher() {
  const router = useRouter();
  const refreshingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const triggerRefresh = () => {
      if (refreshingRef.current || document.hidden) return;
      refreshingRef.current = true;
      setTimeout(() => {
        try { router.refresh(); } finally { refreshingRef.current = false; }
      }, 300);
    };

    // 1 canal wildcard en lugar de 25 canales individuales
    const channel = supabase
      .channel("realtime:schema-public")
      .on("postgres_changes", { event: "*", schema: "public" }, triggerRefresh)
      .subscribe();

    // Reanudar/pausar según visibilidad del tab
    const handleVisibility = () => {
      if (!document.hidden) {
        // Tab visible de nuevo — forzar refresh inmediato para sincronizar
        triggerRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
