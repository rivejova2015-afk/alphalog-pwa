// Self-Healing Cache
// Si detecta mismatch entre UI y DB (ej: selector muestra cuenta borrada), invalida cachés específicas silenciosamente.
// No muestra banners ni popups.

import { useEffect } from "react";

export function useSelfHealingCache(detectMismatch: () => Promise<boolean>, invalidateCache: () => void, onLog?: (msg: string) => void) {
  useEffect(() => {
    let cancelled = false;
    async function run() {
      while (!cancelled) {
        const mismatch = await detectMismatch();
        if (mismatch) {
          onLog?.("Mismatch detectado. Invalidando caché...");
          invalidateCache();
          onLog?.("Caché invalidada.");
        }
        await new Promise(res => setTimeout(res, 30000)); // 30s
      }
    }
    run();
    return () => { cancelled = true; };
  }, [detectMismatch, invalidateCache, onLog]);
}
