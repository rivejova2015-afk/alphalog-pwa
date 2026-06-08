// src/lib/business/offline-loader.ts
/**
 * Helper to load business data either from API (online) or offline snapshot
 * Supports graceful degradation when offline or no session
 */

import { isOffline, hasSession, getBusinessOfflineData } from "@/lib/offline/snapshot";
import type { DashboardSnapshot } from "@/lib/offline/idb";
import { logWarn } from "@/lib/log";

export type BusinessOfflineData = DashboardSnapshot["business"];

/**
 * Load business costs - from API if online, from snapshot if offline
 */
export async function loadBusinessCosts(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  // If offline data is explicitly provided, use it
  if (offlineData?.costs) {
    return offlineData.costs;
  }

  // If online and has session, try to fetch from API
  if (!isOffline() && hasSession()) {
    try {
      const { getBusinessCosts } = await import("@/lib/business/queries");
      return await getBusinessCosts();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching costs, falling back to snapshot", { component: "business.offline.costs.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Fall back to snapshot
  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.costs || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot costs", { component: "business.offline.costs.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load business milestones - from API if online, from snapshot if offline
 */
export async function loadBusinessMilestones(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.milestones) {
    return offlineData.milestones;
  }

  if (!isOffline() && hasSession()) {
    try {
      const { getBusinessMilestones } = await import("@/lib/business/queries");
      return await getBusinessMilestones();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching milestones, falling back to snapshot", { component: "business.offline.milestones.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.milestones || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot milestones", { component: "business.offline.milestones.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load business SOPs - from API if online, from snapshot if offline
 */
export async function loadBusinessSOPs(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.sops) {
    return offlineData.sops;
  }

  if (!isOffline() && hasSession()) {
    try {
      const { getBusinessSOPs } = await import("@/lib/business/queries");
      return await getBusinessSOPs();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching SOPs, falling back to snapshot", { component: "business.offline.sops.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sops || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot SOPs", { component: "business.offline.sops.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load SOP items
 */
export async function loadBusinessSOPItems(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.sop_items) {
    return offlineData.sop_items;
  }

  if (!isOffline() && hasSession()) {
    try {
      // Note: SOP items are nested within SOPs, not fetched separately
      // This returns cached sop_items from snapshot or empty array
      return [];
    } catch (err) {
      logWarn("BusinessOffline", "Error with SOP items, falling back to snapshot", { component: "business.offline.sopItems.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sop_items || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot SOP items", { component: "business.offline.sopItems.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load SOP runs
 */
export async function loadBusinessSOPRuns(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.sop_runs) {
    return offlineData.sop_runs;
  }

  if (!isOffline() && hasSession()) {
    try {
      // Note: SOP runs are fetched per SOP, not globally
      // This returns cached sop_runs from snapshot or empty array
      return [];
    } catch (err) {
      logWarn("BusinessOffline", "Error with SOP runs, falling back to snapshot", { component: "business.offline.sopRuns.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sop_runs || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot SOP runs", { component: "business.offline.sopRuns.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load business decisions - from API if online, from snapshot if offline
 */
export async function loadBusinessDecisions(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.decisions) {
    return offlineData.decisions;
  }

  if (!isOffline() && hasSession()) {
    try {
      const { getBusinessDecisions } = await import("@/lib/business/queries");
      return await getBusinessDecisions();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching decisions, falling back to snapshot", { component: "business.offline.decisions.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.decisions || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot decisions", { component: "business.offline.decisions.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load decision tasks
 */
export async function loadBusinessDecisionTasks(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.tasks) {
    return offlineData.tasks;
  }

  if (!isOffline() && hasSession()) {
    try {
      // Note: Decision tasks are fetched per decision, not globally
      // This returns cached tasks from snapshot or empty array
      return [];
    } catch (err) {
      logWarn("BusinessOffline", "Error with decision tasks, falling back to snapshot", { component: "business.offline.decisionTasks.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.tasks || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot tasks", { component: "business.offline.decisionTasks.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/**
 * Load LLC info
 */
export async function loadLLCInfo(
  offlineData?: BusinessOfflineData | null
): Promise<unknown | null> {
  if (offlineData?.llc_info) {
    return offlineData.llc_info;
  }

  if (!isOffline() && hasSession()) {
    try {
      const { getLLCInfo } = await import("@/lib/business/queries");
      return await getLLCInfo();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching LLC info, falling back to snapshot", { component: "business.offline.llcInfo.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.llc_info || null;
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot LLC info", { component: "business.offline.llcInfo.snapshot", error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Load LLC inbox messages
 */
export async function loadLLCInbox(
  offlineData?: BusinessOfflineData | null
): Promise<unknown[]> {
  if (offlineData?.llc_inbox) {
    return offlineData.llc_inbox;
  }

  if (!isOffline() && hasSession()) {
    try {
      const { getLLCInboxItems } = await import("@/lib/business/queries");
      return await getLLCInboxItems();
    } catch (err) {
      logWarn("BusinessOffline", "Error fetching LLC inbox, falling back to snapshot", { component: "business.offline.llcInbox.fetch", error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.llc_inbox || [];
  } catch (err) {
    logWarn("BusinessOffline", "Error loading snapshot LLC inbox", { component: "business.offline.llcInbox.snapshot", error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}
