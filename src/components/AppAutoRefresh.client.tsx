"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AppAutoRefresh: Monitorea cambios en el servidor y notifica/recarga automáticamente.
 * FIX: buildHash en useRef (no state) → evita loop: setBuildHash → effect destruye/
 * recrea el interval → stale closure infinito. Pausa checks en tab background.
 */
export default function AppAutoRefresh() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const buildHashRef = useRef<string | null>(null);

  // ── Hash polling — effect único sin dependencias ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const getHash = async (): Promise<string | null> => {
      try {
        const res = await fetch("/manifest.webmanifest?" + Date.now());
        return btoa(await res.text()).substring(0, 16);
      } catch {
        return null;
      }
    };

    // Hash inicial
    getHash().then((h) => {
      if (h && !cancelled) buildHashRef.current = h;
    });

    const checkInterval = setInterval(async () => {
      if (cancelled || document.hidden) return;
      const newHash = await getHash();
      if (!newHash || !buildHashRef.current) return;
      if (newHash !== buildHashRef.current) {
        buildHashRef.current = newHash;
        setUpdateAvailable(true);
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(checkInterval);
    };
  }, []); // sin dependencias — buildHashRef es estable

  // ── Service Worker messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.serviceWorker?.controller) return;

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") setUpdateAvailable(true);
    };

    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    const swCheckInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CHECK_UPDATE" });
      }
    }, 60_000);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      clearInterval(swCheckInterval);
    };
  }, []);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 rounded-lg border border-blue-700 bg-blue-900/95 px-4 py-3 text-blue-100 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-4">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold">Nueva actualización disponible</div>
        <div className="text-xs text-blue-300">Se han detectado cambios en la aplicación</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => window.location.reload()}
          className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          Recargar ahora
        </button>
        <button
          onClick={() => setUpdateAvailable(false)}
          className="whitespace-nowrap rounded-md bg-blue-800 px-3 py-1.5 text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          Luego
        </button>
      </div>
    </div>
  );
}
