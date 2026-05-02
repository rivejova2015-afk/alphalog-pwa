// Multi-symbol portfolio backtest: run multiple strategy/symbol pairs in parallel,
// then aggregate equity curves with proper time alignment to compute portfolio
// metrics (correlation matrix, portfolio Sharpe, aggregate max DD).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bar, BacktestConfig, BacktestResult, EquityPoint } from "@/types/backtest";
import { runBacktest } from "./engine";
import { loadHistoricalBars } from "./bars-loader";

export interface PortfolioLeg {
  configId: string; // human label
  symbol: string;
  weight: number;   // capital allocation; normalized internally
  cfg: BacktestConfig;
}

export interface PortfolioMetrics {
  totalPnl: number;
  totalReturnPct: number;
  sharpe: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  legCorrelations: { a: string; b: string; rho: number }[];
}

export interface PortfolioResult {
  legs: { configId: string; result: BacktestResult }[];
  portfolioEquity: EquityPoint[];
  metrics: PortfolioMetrics;
}

export async function runPortfolio(
  supabase: SupabaseClient,
  legs: PortfolioLeg[],
): Promise<PortfolioResult> {
  // Normalize weights
  const totalW = legs.reduce((s, l) => s + l.weight, 0) || 1;
  const norm = legs.map((l) => ({ ...l, weight: l.weight / totalW }));

  // Run all legs in parallel
  const legResults = await Promise.all(
    norm.map(async (leg) => {
      const bars = await loadHistoricalBars(supabase, leg.symbol, leg.cfg.timeframe, leg.cfg.from, leg.cfg.to);
      const result = await runBacktest(bars as Bar[], leg.cfg);
      return { leg, result };
    }),
  );

  // Build a unified time grid (all unique bar timestamps across legs)
  const allTs = new Set<string>();
  for (const lr of legResults) for (const p of lr.result.equityCurve) allTs.add(p.ts);
  const grid = Array.from(allTs).sort();

  // Forward-fill each leg's equity onto the grid, weighted-aggregate
  const portfolio: EquityPoint[] = [];
  let peak = 0, maxDD = 0;
  for (const ts of grid) {
    let agg = 0;
    for (const lr of legResults) {
      const eq = forwardFillEquity(lr.result.equityCurve, ts, lr.leg.cfg.initialBalance);
      agg += eq * lr.leg.weight;
    }
    if (agg > peak) peak = agg;
    const dd = peak - agg;
    if (dd > maxDD) maxDD = dd;
    portfolio.push({ ts, equity: agg, drawdown: dd });
  }

  const initial = legResults.reduce((s, lr) => s + lr.leg.cfg.initialBalance * lr.leg.weight, 0);
  const final = portfolio[portfolio.length - 1]?.equity ?? initial;
  const totalPnl = final - initial;
  const totalReturnPct = (totalPnl / initial) * 100;
  const sharpe = computeSharpe(portfolio);

  // Pairwise correlations between leg equity returns
  const legReturns = legResults.map((lr) => ({
    id: lr.leg.configId,
    returns: equityToReturns(lr.result.equityCurve),
  }));
  const corrs: { a: string; b: string; rho: number }[] = [];
  for (let i = 0; i < legReturns.length; i++) {
    for (let j = i + 1; j < legReturns.length; j++) {
      const rho = pearson(legReturns[i].returns, legReturns[j].returns);
      corrs.push({ a: legReturns[i].id, b: legReturns[j].id, rho: +rho.toFixed(3) });
    }
  }

  return {
    legs: legResults.map((lr) => ({ configId: lr.leg.configId, result: lr.result })),
    portfolioEquity: portfolio,
    metrics: {
      totalPnl: +totalPnl.toFixed(2),
      totalReturnPct: +totalReturnPct.toFixed(2),
      sharpe: +sharpe.toFixed(3),
      maxDrawdown: +maxDD.toFixed(2),
      maxDrawdownPct: +((maxDD / peak) * 100).toFixed(2),
      legCorrelations: corrs,
    },
  };
}

function forwardFillEquity(curve: EquityPoint[], ts: string, fallback: number): number {
  const t = new Date(ts).getTime();
  let lo = 0, hi = curve.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (new Date(curve[m].ts).getTime() <= t) { ans = m; lo = m + 1; }
    else hi = m - 1;
  }
  return ans >= 0 ? curve[ans].equity : fallback;
}

function equityToReturns(curve: EquityPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].equity;
    if (prev > 0) out.push(curve[i].equity / prev - 1);
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  const denom = Math.sqrt(va * vb);
  return denom === 0 ? 0 : cov / denom;
}

function computeSharpe(curve: EquityPoint[]): number {
  const r = equityToReturns(curve);
  if (r.length < 2) return 0;
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  let v = 0;
  for (const x of r) v += (x - m) ** 2;
  v /= r.length - 1;
  const sd = Math.sqrt(v);
  return sd === 0 ? 0 : (m / sd) * Math.sqrt(252);
}
