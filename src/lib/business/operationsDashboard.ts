import "server-only";

import { createClient } from "@/lib/supabase/server";
import { calculatePLMetrics, calculateRunwayMetrics, getMonthStr, getLastNMonths, type PLMetrics } from "./metrics";
import type { BusinessCost } from "./types";
import type { Trade } from "@/lib/treasury/calculations";

/**
 * Aggregated tiles for /business/operations. Designed to be:
 * - Cheap to compute (each underlying query uses head/count where possible)
 * - Testable: the pure `buildOperationsDashboard()` consumes pre-fetched data
 *   and can be unit-tested without mocking Supabase.
 */
export interface OperationsDashboard {
  decisionsPending: number;   // decisions with at least one unfinished task
  sopsToRun: number;          // SOPs not run during the current UTC month
  milestonesPending: number;
  costsTotalMonth: number;    // sum of business_costs.amount for current month
  netPnlMonth: number;        // current-month net P&L
  runwayMonths: number;       // months of cash remaining at current burn (∞ if no burn)
  cashReserve: number;        // sum of treasury_wallets.starting_balance (rough)
}

export interface OperationsDashboardInput {
  // Decisions: each decision with its pending-task count
  decisions: Array<{ id: string; pendingTaskCount: number }>;
  // SOPs
  sopsTotal: number;
  sopRunsThisMonthSopIds: string[]; // unique sop_ids that have a run this month
  // Milestones
  milestonesPending: number;
  // Costs (raw rows for current month)
  monthCosts: BusinessCost[];
  // Trades (used for P&L; pre-fetched for last 3 months)
  trades: Trade[];
  // Cash for runway
  cashReserve: number;
}

/**
 * Pure: composes the dashboard from pre-fetched inputs. No I/O.
 */
export function buildOperationsDashboard(input: OperationsDashboardInput): OperationsDashboard {
  const decisionsPending = input.decisions.filter((d) => d.pendingTaskCount > 0).length;

  const sopsRunSet = new Set(input.sopRunsThisMonthSopIds);
  // "SOPs to run" = sopsTotal - distinct sops that already ran this month.
  // Clamp at 0 in case a SOP was deleted after its run.
  const sopsToRun = Math.max(0, input.sopsTotal - sopsRunSet.size);

  const costsTotalMonth = input.monthCosts.reduce(
    (sum, c) => sum + Number(c.amount ?? 0),
    0,
  );

  // P&L for the current month
  const currentMonth = getMonthStr();
  const plCurrent = calculatePLMetrics(input.trades, input.monthCosts, currentMonth);

  // Runway needs last 3 months of PL
  const last3 = getLastNMonths(3);
  const plLast3: PLMetrics[] = last3.map((m) =>
    calculatePLMetrics(input.trades, input.monthCosts, m),
  );
  const runway = calculateRunwayMetrics(plLast3, input.cashReserve);

  return {
    decisionsPending,
    sopsToRun,
    milestonesPending: input.milestonesPending,
    costsTotalMonth,
    netPnlMonth: plCurrent.netIncome,
    runwayMonths: runway.runwayMonths,
    cashReserve: input.cashReserve,
  };
}

/**
 * Async loader: runs all the Supabase queries in parallel, then delegates to the
 * pure builder. Keep the I/O layer thin so business logic stays unit-testable.
 */
export async function loadOperationsDashboardData(userId: string): Promise<OperationsDashboard> {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const startOfMonthIso = startOfMonth.toISOString();
  const startOfMonthDate = startOfMonthIso.split("T")[0];

  // 90-day window for trades — enough to cover last-3-months runway
  const trades90Cutoff = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
  const trades90CutoffIso = trades90Cutoff.toISOString();

  const [
    decisionRows,
    decisionTaskRows,
    sopsCountRes,
    sopRunsThisMonthRes,
    milestonesPendingRes,
    monthCostsRes,
    tradesRes,
    walletsRes,
  ] = await Promise.all([
    supabase.from("business_decisions").select("id").eq("user_id", userId).is("deleted_at", null),
    supabase.from("business_decision_tasks").select("decision_id, done").eq("user_id", userId).is("deleted_at", null),
    supabase.from("business_sops").select("id", { head: true, count: "exact" }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("business_sop_runs").select("sop_id").eq("user_id", userId).is("deleted_at", null).gte("run_date", startOfMonthDate),
    supabase.from("business_milestones").select("id", { head: true, count: "exact" }).eq("user_id", userId).is("deleted_at", null).neq("status", "completed"),
    supabase.from("business_costs").select("*").eq("user_id", userId).is("deleted_at", null).gte("cost_date", startOfMonthDate),
    supabase.from("trades").select("id, account_id, pnl, exit_date, status").eq("user_id", userId).is("deleted_at", null).eq("status", "closed").gte("exit_date", trades90CutoffIso.split("T")[0]),
    supabase.from("treasury_wallets").select("starting_balance").eq("user_id", userId).is("deleted_at", null),
  ]);

  // Decisions: count pending tasks per decision id
  const pendingByDecision = new Map<string, number>();
  for (const row of (decisionTaskRows.data ?? []) as Array<{ decision_id: string; done: boolean }>) {
    if (!row.done) {
      pendingByDecision.set(row.decision_id, (pendingByDecision.get(row.decision_id) ?? 0) + 1);
    }
  }
  const decisions = (decisionRows.data ?? []).map((d) => ({
    id: d.id as string,
    pendingTaskCount: pendingByDecision.get(d.id as string) ?? 0,
  }));

  const sopRunsThisMonthSopIds = (sopRunsThisMonthRes.data ?? []).map(
    (r) => (r as { sop_id: string }).sop_id,
  );

  // Cash reserve estimate: sum of wallet starting_balance.
  // This is a rough proxy until live balance tracking is wired through
  // treasury_transactions. Adequate for the dashboard tile.
  const cashReserve = (walletsRes.data ?? []).reduce(
    (sum, w) => sum + Number((w as { starting_balance: number | null }).starting_balance ?? 0),
    0,
  );

  return buildOperationsDashboard({
    decisions,
    sopsTotal: sopsCountRes.count ?? 0,
    sopRunsThisMonthSopIds,
    milestonesPending: milestonesPendingRes.count ?? 0,
    monthCosts: (monthCostsRes.data ?? []) as BusinessCost[],
    trades: (tradesRes.data ?? []) as Trade[],
    cashReserve,
  });
}
