import type { SimulatedTrade } from '@/types/backtest';

export interface MonteCarloResult {
  iterations: number;
  finalEquityPercentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  maxDrawdownPercentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  probProfitable: number;
  probRuin: number;        // probability equity hit 0 along the way
  worstCase: number;
  bestCase: number;
  cone: { step: number; p5: number; p50: number; p95: number }[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function shuffleSample(trades: SimulatedTrade[], rng: () => number): SimulatedTrade[] {
  const n = trades.length;
  const out: SimulatedTrade[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = trades[Math.floor(rng() * n)];
  return out;
}

function blockBootstrap(trades: SimulatedTrade[], blockSize: number, rng: () => number): SimulatedTrade[] {
  const n = trades.length;
  const out: SimulatedTrade[] = [];
  while (out.length < n) {
    const start = Math.floor(rng() * n);
    for (let i = 0; i < blockSize && out.length < n; i++) {
      out.push(trades[(start + i) % n]);
    }
  }
  return out;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runMonteCarlo(
  trades: SimulatedTrade[],
  initialBalance: number,
  iterations = 1000,
  blockSize = 5,
  seed = 42,
): MonteCarloResult {
  if (trades.length === 0) {
    return {
      iterations: 0,
      finalEquityPercentiles: { p5: initialBalance, p25: initialBalance, p50: initialBalance, p75: initialBalance, p95: initialBalance },
      maxDrawdownPercentiles: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      probProfitable: 0,
      probRuin: 0,
      worstCase: initialBalance,
      bestCase: initialBalance,
      cone: [],
    };
  }

  const rng = mulberry32(seed);
  const finals: number[] = [];
  const maxDDs: number[] = [];
  let profitable = 0;
  let ruined = 0;

  const STEPS = Math.min(50, trades.length);
  const stepEvery = Math.max(1, Math.floor(trades.length / STEPS));
  const coneByStep: number[][] = Array.from({ length: STEPS + 1 }, () => []);

  for (let it = 0; it < iterations; it++) {
    const path = it % 2 === 0 ? shuffleSample(trades, rng) : blockBootstrap(trades, blockSize, rng);
    let bal = initialBalance;
    let peak = initialBalance;
    let maxDdPct = 0;
    let hitZero = false;
    let coneIdx = 0;
    coneByStep[0].push(bal);
    for (let i = 0; i < path.length; i++) {
      bal += path[i].pnl;
      if (bal <= 0) { bal = 0; hitZero = true; }
      if (bal > peak) peak = bal;
      const dd = peak > 0 ? (peak - bal) / peak : 0;
      if (dd > maxDdPct) maxDdPct = dd;
      if ((i + 1) % stepEvery === 0 && coneIdx < STEPS) {
        coneIdx++;
        coneByStep[coneIdx].push(bal);
      }
    }
    while (coneIdx < STEPS) { coneIdx++; coneByStep[coneIdx].push(bal); }
    finals.push(bal);
    maxDDs.push(maxDdPct);
    if (bal > initialBalance) profitable++;
    if (hitZero) ruined++;
  }

  finals.sort((a, b) => a - b);
  maxDDs.sort((a, b) => a - b);
  const cone = coneByStep.map((vals, step) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      step,
      p5:  +percentile(sorted, 5).toFixed(2),
      p50: +percentile(sorted, 50).toFixed(2),
      p95: +percentile(sorted, 95).toFixed(2),
    };
  });

  return {
    iterations,
    finalEquityPercentiles: {
      p5:  +percentile(finals, 5).toFixed(2),
      p25: +percentile(finals, 25).toFixed(2),
      p50: +percentile(finals, 50).toFixed(2),
      p75: +percentile(finals, 75).toFixed(2),
      p95: +percentile(finals, 95).toFixed(2),
    },
    maxDrawdownPercentiles: {
      p5:  +percentile(maxDDs, 5).toFixed(4),
      p25: +percentile(maxDDs, 25).toFixed(4),
      p50: +percentile(maxDDs, 50).toFixed(4),
      p75: +percentile(maxDDs, 75).toFixed(4),
      p95: +percentile(maxDDs, 95).toFixed(4),
    },
    probProfitable: +(profitable / iterations).toFixed(4),
    probRuin: +(ruined / iterations).toFixed(4),
    worstCase: +finals[0].toFixed(2),
    bestCase:  +finals[finals.length - 1].toFixed(2),
    cone,
  };
}
