// src/app/dashboard/treasury/page.tsx
// Server component (Sprint 2 — Activación 70% dormido).
// Pre-fetches accounts, configs, wallets, transactions, payouts, budgets,
// trades for the logged-in user and hands them to TreasuryShell.client.tsx.
//
// Previously this file was a client component that passed empty arrays to
// TreasuryTabs, so the Treasury UI never rendered real data. This rewrite
// is the root-cause fix for the data-pipeline gap identified in the audit.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TreasuryShell from "@/components/treasury/TreasuryShell.client";
import type { Account, TreasuryConfig, Trade } from "@/lib/treasury/calculations";
import type {
  TreasuryTransaction,
  TreasuryPayout,
  TreasuryBudget,
  TreasuryWallet,
} from "@/lib/treasury/queries";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [
    accountsRes,
    configsRes,
    walletsRes,
    transactionsRes,
    payoutsRes,
    budgetsRes,
    tradesRes,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_size, current_balance, phase_status, withdrawals_enabled")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("treasury_configs")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("treasury_wallets")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("treasury_transactions")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .limit(200),
    supabase
      .from("treasury_payouts")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("payout_date", { ascending: false })
      .limit(50),
    supabase
      .from("treasury_budgets")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("period_start", { ascending: false })
      .limit(20),
    supabase
      .from("trades")
      .select("id, account_id, entry_date, exit_date, pnl, status")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .ilike("status", "closed"),
  ]);

  // Normalize accounts: schema allows NULL for account_size/current_balance,
  // but the calculations.ts Account interface requires numbers.
  const accounts: Account[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id as string,
    name: (a.name as string) ?? "",
    account_size: Number(a.account_size ?? 0),
    current_balance: Number(a.current_balance ?? a.account_size ?? 0),
    phase_status: (a.phase_status as string | null) ?? undefined,
    withdrawals_enabled: a.withdrawals_enabled !== false,
  }));

  const configs: TreasuryConfig[] = (configsRes.data ?? []).map((c) => ({
    id: c.id as string,
    user_id: c.user_id as string,
    account_id: c.account_id as string,
    withdrawal_day: Number(c.withdrawal_day ?? 1),
    split_mode: (c.split_mode as "growth" | "safe" | "cash") ?? "safe",
    balance_threshold: c.balance_threshold == null ? undefined : Number(c.balance_threshold),
    anti_drawdown_active: c.anti_drawdown_active === true,
    anti_drawdown_threshold: Number(c.anti_drawdown_threshold ?? 20),
    tax_buffer_percentage: Number(c.tax_buffer_percentage ?? 30),
    tax_buffer_accumulated: Number(c.tax_buffer_accumulated ?? 0),
    tax_buffer_target: c.tax_buffer_target == null ? undefined : Number(c.tax_buffer_target),
    milestone_target: c.milestone_target == null ? undefined : Number(c.milestone_target),
    milestone_bonus_vault: Number(c.milestone_bonus_vault ?? 0),
    wallet_id: (c.wallet_id as string | null) ?? undefined,
    last_threshold_push_cycle_start: (c.last_threshold_push_cycle_start as string | null) ?? undefined,
  }));

  const wallets = (walletsRes.data ?? []) as TreasuryWallet[];
  const transactions = (transactionsRes.data ?? []) as TreasuryTransaction[];
  const payouts = (payoutsRes.data ?? []) as TreasuryPayout[];
  const budgets = (budgetsRes.data ?? []) as TreasuryBudget[];

  const trades: Trade[] = (tradesRes.data ?? []).map((t) => ({
    id: t.id as string,
    account_id: t.account_id as string,
    entry_date: (t.entry_date as string) ?? "",
    exit_date: (t.exit_date as string | null) ?? undefined,
    pnl: Number(t.pnl ?? 0),
    status: ((t.status as string) ?? "").toLowerCase() === "closed" ? "Closed" : "Open",
  }));

  return (
    <TreasuryShell
      accounts={accounts}
      configs={configs}
      wallets={wallets}
      trades={trades}
      transactions={transactions}
      payouts={payouts}
      budgets={budgets}
    />
  );
}
