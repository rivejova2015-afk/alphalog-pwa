// src/components/OfflineBanner.client.tsx
"use client";

import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    // Listen to online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="w-full bg-amber-900/30 border-b border-amber-700 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <span>📡</span>
          <span>Offline — modo lectura</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
