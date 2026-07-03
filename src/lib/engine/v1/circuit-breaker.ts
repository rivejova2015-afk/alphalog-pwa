// Circuit breaker — reads recent algorithm_trades to decide whether to halt
// new entries. Three checks, any one trips the breaker:
//   1. consecutive_losses: N most recent closed trades all negative PnL
//   2. daily_dd_pct:  sum(pnl) of trades closed today is below -threshold% of equity
//   3. weekly_dd_pct: same for the rolling 7-day window
// When disabled, returns {tripped: false}.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineConfig } from "@/lib/validations/engine-config";

type BreakerCfg = EngineConfig["modules"]["circuit_breaker"];

export interface BreakerCheckResult {
  tripped: boolean;
  reason?: string;
  daily_pnl?: number;
  weekly_pnl?: number;
  consecutive_loss_count?: number;
}

interface TradeRow {
  pnl: number | null;
  closed_at: string | null;
}

export async function checkBreaker(
  supabase: SupabaseClient,
  algorithmId: string,
  cfg: BreakerCfg,
  equity: number,
): Promise<BreakerCheckResult> {
  if (!cfg.enabled) return { tripped: false };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("algorithm_trades")
    .select("pnl, closed_at")
    .eq("algorithm_id", algorithmId)
    .eq("status", "closed")
    .gte("closed_at", weekAgo)
    .order("closed_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    // Fail-closed by default: trip the breaker on infra errors instead of
    // silently letting new entries through exactly when risk controls are
    // most needed. `fail_open_on_error: true` restores the old behavior
    // for callers that explicitly opt into it.
    const failOpen = cfg.fail_open_on_error === true;
    return {
      tripped: !failOpen,
      reason: failOpen ? "breaker_query_failed_fail_open" : "breaker_query_failed_fail_closed",
    };
  }

  const trades = data as TradeRow[];

  // Consecutive losses from most recent
  let consec = 0;
  for (const t of trades) {
    if ((t.pnl ?? 0) < 0) consec++;
    else break;
  }
  if (consec >= cfg.consecutive_losses) {
    return { tripped: true, reason: `consecutive_losses:${consec}`, consecutive_loss_count: consec };
  }

  // Daily / weekly PnL aggregates
  const startOfDayMs = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();
  let dailyPnl = 0;
  let weeklyPnl = 0;
  for (const t of trades) {
    if (!t.closed_at) continue;
    const tsMs = new Date(t.closed_at).getTime();
    const pnl = t.pnl ?? 0;
    weeklyPnl += pnl;
    if (tsMs >= startOfDayMs) dailyPnl += pnl;
  }

  const safeEquity = Math.max(1, equity);
  const dailyDdPct = (dailyPnl / safeEquity) * 100;
  const weeklyDdPct = (weeklyPnl / safeEquity) * 100;

  if (dailyDdPct < -cfg.daily_dd_pct) {
    return { tripped: true, reason: `daily_dd:${dailyDdPct.toFixed(2)}%`, daily_pnl: dailyPnl, weekly_pnl: weeklyPnl };
  }
  if (weeklyDdPct < -cfg.weekly_dd_pct) {
    return { tripped: true, reason: `weekly_dd:${weeklyDdPct.toFixed(2)}%`, daily_pnl: dailyPnl, weekly_pnl: weeklyPnl };
  }

  return { tripped: false, daily_pnl: dailyPnl, weekly_pnl: weeklyPnl, consecutive_loss_count: consec };
}
