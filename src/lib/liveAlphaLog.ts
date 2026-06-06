// Live AlphaLog: central realtime bridge across app modules
// Lightweight service that opens Supabase realtime channels and notifies on any data change.

import { createClient } from "@/lib/supabase/browser";
import { logWarn } from "@/lib/log";

export type LiveAlphaLogStatus = "connecting" | "connected" | "stopped" | "error";

export interface LiveAlphaLogOptions {
  tables?: string[];
  onEvent?: (payload: unknown) => void;
}

export interface LiveAlphaLogService {
  stop: () => void;
  status: LiveAlphaLogStatus;
}

const DEFAULT_TABLES: string[] = [
  // Treasury & Trades
  "trades",
  "accounts",
  "treasury_transactions",
  "treasury_payouts",
  "treasury_configs",
  "treasury_budgets",
  "treasury_wallets",
  "treasury_calendar_events",
  // Business
  "business_costs",
  "business_cost_templates",
  "business_milestones",
  "business_sops",
  "business_sop_items",
  "business_sop_runs",
  "business_sop_run_items",
  "business_decisions",
  "business_decision_tasks",
  "llc_info",
  "llc_inbox",
  // Secure Mail (Inbox)
  "secure_mailboxes",
  "secure_messages",
  "secure_attachments",
  "secure_allowed_senders",
  "secure_contacts_keys",
  "secure_message_access_audit",
  // Logs
  "app_logs",
];

export function startLiveAlphaLog(options: LiveAlphaLogOptions = {}): LiveAlphaLogService {
  const supabase = createClient();
  const tables = options.tables?.length ? options.tables : DEFAULT_TABLES;
  let status: LiveAlphaLogStatus = "connecting";

  const channels = tables.map((table) =>
    supabase
      .channel(`live:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        options.onEvent?.(payload);
      })
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          status = "connected";
        }
      })
  );

  const stop = () => {
    status = "stopped";
    channels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (err) {
        logWarn("LiveAlphaLog", "removeChannel error", { component: "liveAlphaLog.removeChannel", error: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  return { stop, status };
}
