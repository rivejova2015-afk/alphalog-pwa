// Auto-Reconciler Universal
// Reintenta automaticamente todo lo que quede pending_sync (trades, evidence, progress recalcs, mirrors, schedules)
// con backoff exponencial y registro en timeline interno. No afecta la UI.

import { useEffect, useRef } from "react";

export type PendingSyncItem = {
  id: string;
  type: "trade" | "evidence" | "progress" | "mirror" | "schedule";
  payload: unknown;
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

/**
 * Map PendingSyncItem.type to the Supabase table name used by the
 * AlphaCore offline endpoints (/api/alphacore/[table]/...).
 */
function resolveTable(itemType: PendingSyncItem["type"]): string {
  const tableMap: Record<PendingSyncItem["type"], string> = {
    trade: "trades",
    evidence: "trades",      // trade_evidence synced via trades endpoints
    progress: "trades",      // progress recalcs flow through trades
    mirror: "trades",        // mirrored trades
    schedule: "trades",      // schedule entries
  };
  return tableMap[itemType];
}

/**
 * Infer the CRUD operation from the payload shape.
 *
 * Heuristics:
 *  - If `deleted_at` is set (non-null)           -> delete
 *  - If `id` exists and is NOT a temp ID         -> update
 *  - Otherwise                                    -> create
 */
function inferOperation(
  payload: Record<string, unknown>
): "create" | "update" | "delete" {
  if (payload.deleted_at) {
    return "delete";
  }
  if (
    typeof payload.id === "string" &&
    payload.id.length > 0 &&
    !payload.id.startsWith("temp_")
  ) {
    return "update";
  }
  return "create";
}

/**
 * Attempt to sync a pending item to the server via the AlphaCore API.
 *
 * Returns true on success, false on failure.
 */
async function syncItem(item: PendingSyncItem): Promise<boolean> {
  try {
    const table = resolveTable(item.type);
    const payload =
      item.payload && typeof item.payload === "object"
        ? (item.payload as Record<string, unknown>)
        : {};

    const operation = inferOperation(payload);

    let url: string;
    let method: string;
    let body: Record<string, unknown>;

    switch (operation) {
      case "create": {
        url = `/api/alphacore/${table}/create`;
        method = "POST";
        body = { payload, outboxId: item.id };
        break;
      }
      case "update": {
        const entityId = payload.id as string;
        url = `/api/alphacore/${table}/${entityId}/update`;
        method = "PATCH";
        body = { payload, outboxId: item.id };
        break;
      }
      case "delete": {
        const entityId = payload.id as string;
        url = `/api/alphacore/${table}/${entityId}/delete`;
        method = "DELETE";
        body = {};
        break;
      }
    }

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(
        `[AutoReconciler] syncItem failed for ${item.id} (${operation} ${table}):`,
        response.status,
        errorData
      );
      return false;
    }

    console.log(
      `[AutoReconciler] syncItem succeeded for ${item.id} (${operation} ${table})`
    );
    return true;
  } catch (err) {
    console.warn(`[AutoReconciler] syncItem error for ${item.id}:`, err);
    return false;
  }
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
