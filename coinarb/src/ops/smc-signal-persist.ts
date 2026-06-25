/**
 * coinarb_smc_signals — analytics persistence for SMC bias detections.
 *
 * The table was created in migration 095 but never populated by code (it had
 * 0 rows since deploy). It's the analytics complement to `coinarb_decisions`:
 *
 *   - `coinarb_decisions`: ENTER/SKIP per filter pass, ~54k rows/month
 *   - `coinarb_smc_signals`: BIAS/BOS/CHOCH detections passing the MTF
 *     threshold, ~1-3 rows/min during active hours.
 *
 * We only persist signals that pass `MTF_CONFIDENCE_MIN` (filtered upstream).
 * Failures already live in `coinarb_decisions` with their reject reason.
 *
 * Best-effort: persistence errors must NOT block the trading loop.
 */

import type { SmcSignal } from '../analysis/smc-detector.js';

/** Strategy id mirror — keep aligned with trading/spot-positions.ts. */
export type StrategyId = 'A' | 'B' | 'M' | 'P' | 'DD';

export interface SmcSignalRow {
  user_id: string;
  agent_id: string;
  strategy_id: StrategyId;
  symbol: string;
  timeframe: string;
  signal_type: 'CHOCH' | 'BOS' | 'BIAS';
  direction: string;
  price: number;
  strength: number;
  detected_at: string;
  meta: {
    swing_high: number | null;
    swing_low: number | null;
    zones_count: number;
    zone_types: string[];
  };
}

export function buildSmcSignalRow(opts: {
  userId: string;
  agentId: string;
  symbol: string;
  timeframe: string;
  signal: SmcSignal;
  price: number;
  now?: Date;
  strategyId?: StrategyId;
}): SmcSignalRow {
  const signalType: SmcSignalRow['signal_type'] =
    opts.signal.choch ? 'CHOCH' : opts.signal.bos ? 'BOS' : 'BIAS';
  return {
    user_id: opts.userId,
    agent_id: opts.agentId,
    strategy_id: opts.strategyId ?? 'A',
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    signal_type: signalType,
    direction: opts.signal.bias,
    price: opts.price,
    strength: opts.signal.confidence,
    detected_at: (opts.now ?? new Date()).toISOString(),
    meta: {
      swing_high: opts.signal.swingHigh,
      swing_low: opts.signal.swingLow,
      zones_count: opts.signal.zones.length,
      zone_types: Array.from(new Set(opts.signal.zones.map((z) => z.type))),
    },
  };
}

type SupabaseLike = {
  from(table: string): {
    // PromiseLike (thenable) — Supabase's PostgrestFilterBuilder isn't a true Promise.
    insert(row: SmcSignalRow): PromiseLike<{ error: { message: string } | null }>;
  };
};

export async function persistSmcSignal(
  supabase: SupabaseLike,
  row: SmcSignalRow,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('coinarb_smc_signals').insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
