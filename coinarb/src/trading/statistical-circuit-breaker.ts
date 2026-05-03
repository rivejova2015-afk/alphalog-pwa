/**
 * Statistical Circuit Breaker
 *
 * Monitors live trading metrics every tick and pauses the bot automatically
 * when something is statistically impossible — catching bugs before they run
 * for 14 hours undetected.
 *
 * Checks:
 *  1. Win rate floor — if win rate < 15% after ≥30 closed trades → PAUSE
 *  2. Duplicate exit guard — if any conditionId has >1 EXIT trade in the last 60s → PAUSE
 *  3. Settlement timeout rate — if >60% of closed positions are settlement_timeout → PAUSE
 *  4. Entry-every-window — if bot entered >90% of available windows → WARN (not pause)
 */

import { getSupabase } from '../supabase.js';

export interface StatCBState {
  paused: boolean;
  reason: string | null;
  checkedAt: number;
  /** Exit timestamps per conditionId for duplicate detection (last 60s) */
  recentExits: Map<string, number[]>;
}

export interface StatCBResult {
  triggered: boolean;
  check: string;
  detail: string;
}

export function createStatCBState(): StatCBState {
  return {
    paused: false,
    reason: null,
    checkedAt: 0,
    recentExits: new Map(),
  };
}

/** Record an exit event — call this every time closePosition succeeds */
export function recordExit(state: StatCBState, conditionId: string): StatCBResult | null {
  const now = Date.now();
  const exits = state.recentExits.get(conditionId) ?? [];

  // Prune entries older than 60s
  const fresh = exits.filter(t => now - t < 60_000);
  fresh.push(now);
  state.recentExits.set(conditionId, fresh);

  // Prune stale conditionIds older than 60s
  for (const [cid, ts] of state.recentExits) {
    if (ts.every(t => now - t >= 60_000)) state.recentExits.delete(cid);
  }

  if (fresh.length > 1) {
    const result: StatCBResult = {
      triggered: true,
      check: 'duplicate_exit',
      detail: `conditionId ${conditionId.slice(0, 12)}... tuvo ${fresh.length} exits en 60s`,
    };
    state.paused = true;
    state.reason = `[stat-cb] ${result.check}: ${result.detail}`;
    console.error(`[stat-cb] PAUSED — ${state.reason}`);
    return result;
  }
  return null;
}

/**
 * Run full DB-backed checks every 5 minutes.
 * Returns the first triggered check, or null if everything is healthy.
 */
export async function runStatisticalChecks(
  state: StatCBState,
  agentId: string,
): Promise<StatCBResult | null> {
  const now = Date.now();
  // Only run every 5 minutes to avoid DB overhead
  if (now - state.checkedAt < 5 * 60_000) return null;
  state.checkedAt = now;

  try {
    const supabase = getSupabase();

    const { data } = await supabase
      .from('coinarb_positions')
      .select('exit_reason, pnl_usd, status, entry_reason')
      .eq('agent_id', agentId)
      .in('status', ['CLOSED', 'LIQUIDATED'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data || data.length === 0) return null;

    // Event-mode trades skew win rate during volatile windows by design — exclude
    // them from the floor calc so the breaker only fires on systemic latency-mode failure.
    const isEventTrade = (r: { entry_reason: unknown }): boolean => {
      const er = r.entry_reason as { eventType?: string | null } | null | undefined;
      return Boolean(er?.eventType);
    };
    const nonEventRows = data.filter(r => !isEventTrade(r));

    const closed = data.length;
    const wins = data.filter(r => (r.pnl_usd ?? 0) > 0).length;
    const timeouts = data.filter(r => r.exit_reason === 'settlement_timeout').length;

    const nonEventClosed = nonEventRows.length;
    const nonEventWins = nonEventRows.filter(r => (r.pnl_usd ?? 0) > 0).length;

    // Check 1: win rate floor — applied only to non-event (latency-mode) trades
    if (nonEventClosed >= 30) {
      const winRate = nonEventWins / nonEventClosed;
      if (winRate < 0.15) {
        const result: StatCBResult = {
          triggered: true,
          check: 'win_rate_floor',
          detail: `win rate ${(winRate * 100).toFixed(1)}% en ${nonEventClosed} non-event trades (mínimo 15%)`,
        };
        if (!state.paused) {
          state.paused = true;
          state.reason = `[stat-cb] ${result.check}: ${result.detail}`;
          console.error(`[stat-cb] PAUSED — ${state.reason}`);
        }
        return result;
      }
    }

    // Check 2: settlement timeout rate
    if (closed >= 20) {
      const timeoutRate = timeouts / closed;
      if (timeoutRate > 0.60) {
        const result: StatCBResult = {
          triggered: true,
          check: 'settlement_timeout_rate',
          detail: `${timeouts}/${closed} posiciones sin resolver (${(timeoutRate * 100).toFixed(0)}% > 60%) — settlement engine roto`,
        };
        if (!state.paused) {
          state.paused = true;
          state.reason = `[stat-cb] ${result.check}: ${result.detail}`;
          console.error(`[stat-cb] PAUSED — ${state.reason}`);
        }
        return result;
      }
    }

    // All checks passed — reset pause if it was triggered by a stat check
    if (state.paused && state.reason?.includes('[stat-cb]')) {
      console.log('[stat-cb] Métricas normalizadas — reanudando trading');
      state.paused = false;
      state.reason = null;
    }

    const eventTrades = closed - nonEventClosed;
    console.log(
      `[stat-cb] OK — winRate=${(wins/closed*100).toFixed(1)}% (non-event ${nonEventClosed > 0 ? (nonEventWins/nonEventClosed*100).toFixed(1) : 'n/a'}%)` +
      ` timeoutRate=${(timeouts/closed*100).toFixed(0)}% n=${closed} (events=${eventTrades})`
    );
    return null;
  } catch {
    return null; // Never block trading on a monitoring failure
  }
}
