// Multi-TF trend filter for the generic engine (runBacktest).
//
// What it does: for each higher TF the user configures (e.g., H4 + D1), it
// computes a bias series (close vs EMA50) and uses it to veto entries that
// contradict the higher-TF direction. If ANY higher TF disagrees, the entry
// is blocked. This is the classic "don't fight the higher timeframe" filter.
//
// Why a separate module: keeping it pure (no I/O, no Supabase) makes it
// trivially testable and lets engine.ts inject the precomputed bias caches
// in the hot loop without rebuilding indicators per bar.
//
// Engine v1 (SMC funnel) does NOT use this — its evaluator is multi-TF by
// design (D1 → H1 → M15 → M1). This filter is only meaningful for the
// generic rule-based engine that powers /api/backtest/jobs.

import type { Bar, Side } from '@/types/backtest';
import { ema } from './indicators';

export type Bias = -1 | 0 | 1;  // -1 bear · 0 neutral · 1 bull

export interface BiasCacheEntry {
  bars:  Bar[];        // ascending by ts
  bias:  Bias[];       // aligned 1:1 with bars; NaN bars → 0 (neutral)
  tsMs:  number[];     // precomputed bar.ts → ms, for binary search
}

export type BiasCache = Map<string, BiasCacheEntry>;

export interface MultiTfAlignmentSummary {
  byTf: Record<string, { bull: number; bear: number; neutral: number }>;
  totalPrimaryBars: number;
}

const DEFAULT_EMA_PERIOD = 50;

// close > EMA50 → bull (+1), close < → bear (-1), exact equal or NaN → neutral.
export function computeBiasSeries(bars: Bar[], period: number = DEFAULT_EMA_PERIOD): Bias[] {
  if (bars.length === 0) return [];
  const closes = bars.map((b) => b.close);
  const trend  = ema(closes, period);
  const out: Bias[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const t = trend[i];
    if (!Number.isFinite(t)) { out[i] = 0; continue; }
    if (closes[i] > t)       { out[i] = 1; continue; }
    if (closes[i] < t)       { out[i] = -1; continue; }
    out[i] = 0;
  }
  return out;
}

export function buildBiasCache(
  multiTfBars: Map<string, Bar[]>,
  period: number = DEFAULT_EMA_PERIOD,
): BiasCache {
  const out: BiasCache = new Map();
  for (const [tf, bars] of multiTfBars) {
    const bias = computeBiasSeries(bars, period);
    const tsMs = bars.map((b) => new Date(b.ts).getTime());
    out.set(tf, { bars, bias, tsMs });
  }
  return out;
}

// Binary search for the most recent bar with ts <= target. Returns -1 if no
// such bar exists (target is older than the first bar).
export function findIndexAtOrBefore(tsMs: number[], targetMs: number): number {
  if (tsMs.length === 0 || targetMs < tsMs[0]) return -1;
  let lo = 0, hi = tsMs.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tsMs[mid] <= targetMs) { ans = mid; lo = mid + 1; }
    else                       { hi = mid - 1; }
  }
  return ans;
}

// Returns true if the proposed entry contradicts ANY higher-TF bias.
// - long entry  + any TF bearish → blocked
// - short entry + any TF bullish → blocked
// Neutral TFs and TFs without a corresponding bar (e.g. first hours of the
// dataset) do not block.
export function multiTfBlocks(side: Side, barTs: string, cache: BiasCache): boolean {
  if (cache.size === 0) return false;
  const targetMs = new Date(barTs).getTime();
  for (const entry of cache.values()) {
    const idx = findIndexAtOrBefore(entry.tsMs, targetMs);
    if (idx < 0) continue;
    const bias = entry.bias[idx];
    if (bias === 0) continue;
    if (side === 'long'  && bias === -1) return true;
    if (side === 'short' && bias === 1)  return true;
  }
  return false;
}

// For reporting: for every primary-TF bar, look up the bias at each higher
// TF and tally bull/bear/neutral. The user sees "during this backtest, H4
// was bullish 60% of the time, bearish 30%, neutral 10%". Helps interpret
// why N trades were filtered.
export function summarizeAlignment(
  primaryBars: Bar[],
  cache: BiasCache,
): MultiTfAlignmentSummary {
  const byTf: Record<string, { bull: number; bear: number; neutral: number }> = {};
  for (const tf of cache.keys()) byTf[tf] = { bull: 0, bear: 0, neutral: 0 };
  for (const bar of primaryBars) {
    const targetMs = new Date(bar.ts).getTime();
    for (const [tf, entry] of cache) {
      const idx = findIndexAtOrBefore(entry.tsMs, targetMs);
      if (idx < 0) { byTf[tf].neutral++; continue; }
      const bias = entry.bias[idx];
      if (bias === 1)  byTf[tf].bull++;
      else if (bias === -1) byTf[tf].bear++;
      else byTf[tf].neutral++;
    }
  }
  return { byTf, totalPrimaryBars: primaryBars.length };
}
