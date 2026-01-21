// src/lib/business/offline-loader.ts
/**
 * Helper to load business data either from API (online) or offline snapshot
 * Supports graceful degradation when offline or no session
 */

import { isOffline, hasSession, getBusinessOfflineData } from "@/lib/offline/snapshot";
import type { DashboardSnapshot } from "@/lib/offline/idb";

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
      console.warn("[Business Offline] Error fetching costs, falling back to snapshot:", err);
    }
  }

  // Fall back to snapshot
  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.costs || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot costs:", err);
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
      console.warn("[Business Offline] Error fetching milestones, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.milestones || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot milestones:", err);
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
      console.warn("[Business Offline] Error fetching SOPs, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sops || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot SOPs:", err);
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
      console.warn("[Business Offline] Error with SOP items, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sop_items || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot SOP items:", err);
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
      console.warn("[Business Offline] Error with SOP runs, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.sop_runs || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot SOP runs:", err);
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
      console.warn("[Business Offline] Error fetching decisions, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.decisions || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot decisions:", err);
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
      console.warn("[Business Offline] Error with decision tasks, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.tasks || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot tasks:", err);
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
      console.warn("[Business Offline] Error fetching LLC info, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.llc_info || null;
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot LLC info:", err);
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
      console.warn("[Business Offline] Error fetching LLC inbox, falling back to snapshot:", err);
    }
  }

  try {
    const snapshot = await getBusinessOfflineData();
    return snapshot?.llc_inbox || [];
  } catch (err) {
    console.warn("[Business Offline] Error loading snapshot LLC inbox:", err);
    return [];
  }
}
