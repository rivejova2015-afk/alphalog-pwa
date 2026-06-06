// src/lib/offline/idb.ts
/**
 * IndexedDB helper for offline snapshots
 * No external dependencies
 */

import { logWarn } from "@/lib/log";

// Generic entity type for extensibility
export type Entity = { id?: string; updated_at?: string };

export interface DashboardSnapshot {
  updatedAt: string;
  tradehub: {
    accounts: unknown[];
    trades: unknown[];
    evidence: unknown[];
    playbook: unknown[];
    reports: unknown[];
  };
  tradermap: {
    goals: unknown[];
    levelState: unknown;
  };
  logs: {
    items: unknown[];
  };
  terminal: {
    instruments: unknown[];
    news: unknown[];
    events: unknown[];
    evidenceReports: unknown[];
  };
  treasury: {
    accounts: unknown[];
    configs: unknown[];
    wallets: unknown[];
    transactions: unknown[];
    budgets: unknown[];
    payouts: unknown[];
    trades: unknown[];
    calendar_events: unknown[];
  };
  business: {
    costs: unknown[];
    templates: unknown[];
    milestones: unknown[];
    sops: unknown[];
    sop_items: unknown[];
    sop_runs: unknown[];
    decisions: unknown[];
    tasks: unknown[];
    llc_info: unknown;
    llc_inbox: unknown[];
  };
  botcontrol?: {
    bots: unknown[];
    accounts: unknown[];
    app_accounts?: unknown[];
    telemetry: unknown[];
    commands: unknown[];
    command_status: unknown[];
    settings_global?: unknown;
    settings_override?: unknown[];
  };
}

const DB_NAME = "alphalog";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "dashboard:v1";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveSnapshot(
  snapshot: Partial<DashboardSnapshot>
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const existing = await new Promise<DashboardSnapshot | undefined>((resolve) => {
      const req = store.get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve(req.result);
    });

    const merged: DashboardSnapshot = {
      updatedAt: new Date().toISOString(),
      tradehub: { accounts: [], trades: [], evidence: [], playbook: [], reports: [] },
      tradermap: { goals: [], levelState: null },
      logs: { items: [] },
      terminal: { instruments: [], news: [], events: [], evidenceReports: [] },
      treasury: { accounts: [], configs: [], wallets: [], transactions: [], budgets: [], payouts: [], trades: [], calendar_events: [] },
      business: { costs: [], templates: [], milestones: [], sops: [], sop_items: [], sop_runs: [], decisions: [], tasks: [], llc_info: null, llc_inbox: [] },
      botcontrol: {
        bots: [],
        accounts: [],
        app_accounts: [],
        telemetry: [],
        commands: [],
        command_status: [],
        settings_global: null,
        settings_override: [],
      },
      ...existing,
      ...snapshot,
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(merged, SNAPSHOT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    tx.commit();
  } catch (err) {
    logWarn("IDB", "Error saving snapshot", { component: "offline.idb.save", error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const req = store.get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    logWarn("IDB", "Error reading snapshot", { component: "offline.idb.read", error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(SNAPSHOT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    tx.commit();
  } catch (err) {
    logWarn("IDB", "Error clearing snapshot", { component: "offline.idb.clear", error: err instanceof Error ? err.message : String(err) });
  }
}
