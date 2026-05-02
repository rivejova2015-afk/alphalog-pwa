// Regime detection: classify each bar into trend / range / crash.
// Lightweight: rolling realized volatility + drift, then 3-state Otsu-like split.
// Honest scope: this is NOT a full HMM (no Baum-Welch). It's a fast,
// deterministic classifier good enough for per-regime performance breakdowns.

import type { Bar } from "@/types/backtest";

export type Regime = "trend_up" | "trend_down" | "range" | "crash";

export interface RegimePoint {
  ts: string;
  regime: Regime;
  vol: number;       // realized vol (annualized, rough)
  drift: number;     // rolling mean return
}

export interface RegimePerformance {
  regime: Regime;
  bars: number;
  trades: number;
  winRate: number;
  pnl: number;
  sharpe: number;
}

const SQRT_252 = Math.sqrt(252);

export function classifyRegimes(bars: Bar[], lookback = 30): RegimePoint[] {
  const out: RegimePoint[] = [];
  if (bars.length < lookback) return out;

  // log-returns
  const rets = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    rets[i] = Math.log(bars[i].close / bars[i - 1].close);
  }

  // Compute volatility threshold (75th percentile of rolling vol) for "crash"
  const rollingVol: number[] = [];
  const rollingDrift: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < lookback) {
      rollingVol.push(0);
      rollingDrift.push(0);
      continue;
    }
    let mean = 0;
    for (let j = i - lookback + 1; j <= i; j++) mean += rets[j];
    mean /= lookback;
    let variance = 0;
    for (let j = i - lookback + 1; j <= i; j++) variance += (rets[j] - mean) ** 2;
    variance /= lookback - 1;
    const vol = Math.sqrt(variance) * SQRT_252;
    rollingVol.push(vol);
    rollingDrift.push(mean);
  }

  const sortedVol = [...rollingVol].filter((v) => v > 0).sort((a, b) => a - b);
  const volHigh = sortedVol[Math.floor(sortedVol.length * 0.85)] ?? Infinity;

  for (let i = 0; i < bars.length; i++) {
    const vol = rollingVol[i];
    const drift = rollingDrift[i];
    let regime: Regime = "range";
    if (vol >= volHigh) regime = "crash";
    else if (drift > 1e-4) regime = "trend_up";
    else if (drift < -1e-4) regime = "trend_down";
    out.push({ ts: bars[i].ts, regime, vol, drift });
  }
  return out;
}

export function regimePerformance(
  regimes: RegimePoint[],
  trades: { entryTs: string; exitTs: string; pnl: number }[],
): RegimePerformance[] {
  const tsToRegime = new Map<string, Regime>();
  for (const r of regimes) tsToRegime.set(r.ts, r.regime);

  const buckets = new Map<Regime, { bars: number; trades: number; wins: number; pnls: number[] }>();
  const init = (r: Regime) => {
    if (!buckets.has(r)) buckets.set(r, { bars: 0, trades: 0, wins: 0, pnls: [] });
    return buckets.get(r)!;
  };
  for (const r of regimes) init(r.regime).bars++;

  for (const t of trades) {
    const r = tsToRegime.get(t.entryTs) ?? "range";
    const b = init(r);
    b.trades++;
    if (t.pnl > 0) b.wins++;
    b.pnls.push(t.pnl);
  }

  const out: RegimePerformance[] = [];
  for (const [regime, b] of buckets) {
    const pnl = b.pnls.reduce((s, x) => s + x, 0);
    const m = b.pnls.length > 0 ? pnl / b.pnls.length : 0;
    let v = 0;
    for (const x of b.pnls) v += (x - m) ** 2;
    v = b.pnls.length > 1 ? v / (b.pnls.length - 1) : 0;
    const sd = Math.sqrt(v);
    const sharpe = sd === 0 ? 0 : (m / sd) * SQRT_252;
    out.push({
      regime,
      bars: b.bars,
      trades: b.trades,
      winRate: b.trades > 0 ? b.wins / b.trades : 0,
      pnl,
      sharpe,
    });
  }
  return out.sort((a, b) => b.pnl - a.pnl);
}
