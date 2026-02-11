// Auto-Reconciler Universal
// Reintenta automáticamente todo lo que quede pending_sync (trades, evidence, progress recalcs, mirrors, schedules)
// con backoff exponencial y registro en timeline interno. No afecta la UI.

import { useEffect, useRef } from "react";

export type PendingSyncItem = {
  id: string;
  type: "trade" | "evidence" | "progress" | "mirror" | "schedule";
  payload: any;
  retries: number;
  lastAttempt: number;
};

export type ReconcilerLog = {
  id: string;
  type: string;
  status: "pending" | "success" | "failed";
  timestamp: number;
  message?: string;
};

const MAX_RETRIES = 5;
const BASE_DELAY = 2000; // ms

// Simulación: función para intentar sincronizar un item (debería ser reemplazada por la real)
async function syncItem(item: PendingSyncItem): Promise<boolean> {
  // Aquí iría la lógica real de sync (API, Supabase, etc)
  return Math.random() > 0.3; // 70% éxito simulado
}

export function useAutoReconciler(getPendingItems: () => PendingSyncItem[], onLog: (log: ReconcilerLog) => void) {
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;

    let cancelled = false;

    async function processQueue() {
      while (!cancelled) {
        const items = getPendingItems();
        for (const item of items) {
          if (item.retries >= MAX_RETRIES) continue;
          const delay = BASE_DELAY * Math.pow(2, item.retries);
          await new Promise(res => setTimeout(res, delay));
          const ok = await syncItem(item);
          onLog({
            id: item.id,
            type: item.type,
            status: ok ? "success" : "pending",
            timestamp: Date.now(),
            message: ok ? "Sync OK" : `Retry #${item.retries + 1}`
          });
          if (!ok) {
            item.retries++;
            item.lastAttempt = Date.now();
          }
        }
        await new Promise(res => setTimeout(res, 10000)); // Espera antes de siguiente ciclo
      }
    }

    processQueue();
    return () => { cancelled = true; };
  }, [getPendingItems, onLog]);
}
