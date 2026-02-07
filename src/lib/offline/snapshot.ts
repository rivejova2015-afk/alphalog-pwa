// src/lib/offline/snapshot.ts
import { getSnapshot, saveSnapshot, DashboardSnapshot } from "./idb";

/**
 * Utility functions for saving/loading dashboard snapshots for offline mode
 */

export async function saveTradeHubSnapshot(
  data: Partial<DashboardSnapshot['tradehub']>
): Promise<void> {
  const snapshot = await getSnapshot();
  await saveSnapshot({
    ...snapshot,
    tradehub: data,
  } as Partial<DashboardSnapshot>);
}

export async function saveTradersMapSnapshot(
  data: Partial<DashboardSnapshot['tradermap']>
): Promise<void> {
  const snapshot = await getSnapshot();
  await saveSnapshot({
    ...snapshot,
    tradermap: data,
  } as Partial<DashboardSnapshot>);
}

export async function saveLogsSnapshot(
  data: Partial<DashboardSnapshot['logs']>
): Promise<void> {
  const snapshot = await getSnapshot();
  await saveSnapshot({
    ...snapshot,
    logs: data,
  } as Partial<DashboardSnapshot>);
}

export async function saveTerminalSnapshot(
  data: Partial<DashboardSnapshot['terminal']>
): Promise<void> {
  const snapshot = await getSnapshot();
  await saveSnapshot({
    ...snapshot,
    terminal: data,
  } as Partial<DashboardSnapshot>);
}

export async function saveTreasurySnapshot(
  data: Partial<DashboardSnapshot['treasury']>
): Promise<void> {
  const snapshot = await getSnapshot();
  await saveSnapshot({
    ...snapshot,
    treasury: data,
  } as Partial<DashboardSnapshot>);
}

/**
 * Save treasury data including accounts, configs, payouts, and calendar events
 * Called after fetching treasury data when user is logged in
 */
export async function saveTreasuryDataToSnapshot(data: {
  accounts?: unknown[];
  configs?: unknown[];
  wallets?: unknown[];
  transactions?: unknown[];
  budgets?: unknown[];
  payouts?: unknown[];
  calendar_events?: unknown[];
}): Promise<void> {
  const snapshot = await getSnapshot();
  const treasuryData: DashboardSnapshot['treasury'] = {
    accounts: data.accounts ?? snapshot?.treasury?.accounts ?? [],
    configs: data.configs ?? snapshot?.treasury?.configs ?? [],
    wallets: data.wallets ?? snapshot?.treasury?.wallets ?? [],
    transactions: data.transactions ?? snapshot?.treasury?.transactions ?? [],
    budgets: data.budgets ?? snapshot?.treasury?.budgets ?? [],
    payouts: data.payouts ?? snapshot?.treasury?.payouts ?? [],
    calendar_events: data.calendar_events ?? snapshot?.treasury?.calendar_events ?? [],
    trades: snapshot?.treasury?.trades ?? [],
  };

  await saveSnapshot({
    ...(snapshot || {}),
    treasury: treasuryData,
  });
}

/**
 * Save complete business data including costs, milestones, SOPs, decisions, and LLC info
 * Called after fetching business data when user is logged in
 */
export async function saveBusinessDataToSnapshot(data: {
  costs?: unknown[];
  templates?: unknown[];
  milestones?: unknown[];
  sops?: unknown[];
  sop_items?: unknown[];
  sop_runs?: unknown[];
  decisions?: unknown[];
  tasks?: unknown[];
  llc_info?: unknown;
  llc_inbox?: unknown[];
}): Promise<void> {
  const snapshot = await getSnapshot();
  const businessData: DashboardSnapshot['business'] = {
    costs: data.costs ?? snapshot?.business?.costs ?? [],
    templates: data.templates ?? snapshot?.business?.templates ?? [],
    milestones: data.milestones ?? snapshot?.business?.milestones ?? [],
    sops: data.sops ?? snapshot?.business?.sops ?? [],
    sop_items: data.sop_items ?? snapshot?.business?.sop_items ?? [],
    sop_runs: data.sop_runs ?? snapshot?.business?.sop_runs ?? [],
    decisions: data.decisions ?? snapshot?.business?.decisions ?? [],
    tasks: data.tasks ?? snapshot?.business?.tasks ?? [],
    llc_info: data.llc_info ?? snapshot?.business?.llc_info ?? null,
    llc_inbox: data.llc_inbox ?? snapshot?.business?.llc_inbox ?? [],
  };

  await saveSnapshot({
    ...(snapshot || {}),
    business: businessData,
  });
}

export async function saveBotControlSnapshot(data: {
  bots?: unknown[];
  accounts?: unknown[];
  telemetry?: unknown[];
  commands?: unknown[];
  command_status?: unknown[];
  settings_global?: unknown;
  settings_override?: unknown[];
}): Promise<void> {
  const snapshot = await getSnapshot();
  const botcontrolData = {
    bots: data.bots ?? snapshot?.botcontrol?.bots ?? [],
    accounts: data.accounts ?? snapshot?.botcontrol?.accounts ?? [],
    telemetry: data.telemetry ?? snapshot?.botcontrol?.telemetry ?? [],
    commands: data.commands ?? snapshot?.botcontrol?.commands ?? [],
    command_status: data.command_status ?? snapshot?.botcontrol?.command_status ?? [],
    settings_global: data.settings_global ?? snapshot?.botcontrol?.settings_global ?? null,
    settings_override: data.settings_override ?? snapshot?.botcontrol?.settings_override ?? [],
  };

  await saveSnapshot({
    ...(snapshot || {}),
    botcontrol: botcontrolData,
  });
}

/**
 * Get business snapshot data for offline read-only access
 */
export async function getBusinessOfflineData(): Promise<DashboardSnapshot['business'] | null> {
  const snapshot = await getOfflineSnapshot();
  return snapshot?.business || null;
}

/**
 * Get treasury snapshot data for offline read-only access
 */
export async function getTreasuryOfflineData(): Promise<DashboardSnapshot['treasury'] | null> {
  const snapshot = await getOfflineSnapshot();
  return snapshot?.treasury || null;
}

export async function getBotControlOfflineData(): Promise<DashboardSnapshot['botcontrol'] | null> {
  const snapshot = await getOfflineSnapshot();
  return snapshot?.botcontrol || null;
}

export async function getOfflineSnapshot(): Promise<DashboardSnapshot | null> {
  return getSnapshot();
}

export function isOffline(): boolean {
  if (typeof window === "undefined") return false;
  return !navigator.onLine;
}

export function hasSession(): boolean {
  if (typeof window === "undefined") return false;
  // Simple check for auth token in localStorage
  // In a real app, check with Supabase auth state
  try {
    return !!localStorage.getItem("sb-auth-token") ||
           typeof window !== "undefined" &&
           document.cookie.includes("supabase-auth");
  } catch {
    return false;
  }
}
