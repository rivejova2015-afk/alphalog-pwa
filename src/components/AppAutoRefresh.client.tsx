"use client";

import { useEffect, useState } from "react";

/**
 * AppAutoRefresh: Monitorea cambios en el servidor y notifica/recarga automáticamente
 * - Escucha eventos del Service Worker (UPDATE disponible)
 * - Cada 30 segundos verifica cambios mediante archivo estático
 * - Si detecta cambio: muestra notificación y opción de recargar
 * - Auto-reload opcional después de inactividad
 */
export default function AppAutoRefresh() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [buildHash, setBuildHash] = useState<string | null>(null);

  useEffect(() => {
    // Obtener el hash inicial
    const getBuildHash = async () => {
      try {
        const res = await fetch("/manifest.webmanifest?" + Date.now());
        const data = await res.text();
        const hash = btoa(data).substring(0, 16);
        setBuildHash(hash);
        console.log("[AppAutoRefresh] Initial build hash:", hash);
      } catch {
        console.debug("[AppAutoRefresh] Failed to get initial hash");
      }
    };

    void getBuildHash();

    // Intervalo periódico de chequeo cada 30 segundos
    const checkInterval = setInterval(async () => {
      if (!buildHash) return;
      try {
        const res = await fetch("/manifest.webmanifest?" + Date.now());
        const data = await res.text();
        const newHash = btoa(data).substring(0, 16);
        
        if (newHash !== buildHash) {
          console.log("[AppAutoRefresh] New build detected. Old:", buildHash, "New:", newHash);
          setUpdateAvailable(true);
          setBuildHash(newHash);
        }
      } catch {
        console.debug("[AppAutoRefresh] Periodic check failed");
      }
    }, 30000); // cada 30 segundos

    return () => clearInterval(checkInterval);
  }, [buildHash]);

  // Escuchar mensajes del Service Worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.serviceWorker?.controller) return;

    const handleSWMessage = (event: MessageEvent) => {
      console.log("[AppAutoRefresh] SW message:", event.data);
      
      // El SW notifica cuando detecta una actualización
      if (event.data?.type === "SW_UPDATED") {
        console.log("[AppAutoRefresh] Service Worker update detected");
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    // Pedir al SW que verifique cambios cada 60 segundos
    const swCheckInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CHECK_UPDATE",
        });
      }
    }, 60000);

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
