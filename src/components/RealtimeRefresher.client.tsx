"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

/**
 * RealtimeRefresher
 * Subscribes to Supabase realtime changes on key tables and triggers router.refresh()
 * to reflect new data across the dashboard. Lightweight, no UI.
 */
export default function RealtimeRefresher() {
  const router = useRouter();
  const refreshingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const tables = [
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

    const channels = tables.map((table) =>
      supabase
        .channel(`realtime:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            if (refreshingRef.current) return;
            refreshingRef.current = true;
            // Debounce refresh to avoid cascades
            setTimeout(() => {
              try {
                router.refresh();
              } finally {
                refreshingRef.current = false;
              }
            }, 300);
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => {
        try {
          supabase.removeChannel(ch);
        } catch {}
      });
    };
  }, [router]);

  return null;
}
