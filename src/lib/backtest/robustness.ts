// Robustness statistics: detect overfitting that simple Monte Carlo misses.
// References:
//  - Bailey & López de Prado (2014): Deflated Sharpe Ratio
//  - White (2000): Reality Check for Data Snooping
//  - Bailey, Borwein, López de Prado, Zhu (2016): BDH backtest overfitting

import type { SimulatedTrade } from "@/types/backtest";

export interface RobustnessStats {
  deflatedSharpe: number;        // adjusts for # of trials and skew/kurt
  pbo: number;                   // Probability of Backtest Overfitting [0,1]
  whitePvalue: number;           // White's Reality Check p-value
  trialsTested: number;          // # of independent strategy variations evaluated
  skew: number;
  kurtosis: number;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / (xs.length - 1));
}

function skewness(xs: number[]): number {
  const m = mean(xs);
  const s = stddev(xs);
  if (s === 0 || xs.length < 3) return 0;
  let acc = 0;
  for (const x of xs) acc += ((x - m) / s) ** 3;
  return acc / xs.length;
}

function kurtosis(xs: number[]): number {
  const m = mean(xs);
  const s = stddev(xs);
  if (s === 0 || xs.length < 4) return 0;
  let acc = 0;
  for (const x of xs) acc += ((x - m) / s) ** 4;
  return acc / xs.length;
}

// Standard normal CDF — Abramowitz-Stegun approximation
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const EULER_MASCHERONI = 0.5772156649;

// Deflated Sharpe Ratio (Bailey & López de Prado 2014)
//   Adjusts the observed Sharpe for the number of trials, skewness, and kurtosis.
//   Returns a probability that the true Sharpe > 0 given the multiple-testing context.
export function deflatedSharpe(returns: number[], observedSharpe: number, numTrials: number): number {
  if (returns.length < 30 || numTrials < 1) return 0;

  const sk = skewness(returns);
  const kt = kurtosis(returns);
  const T  = returns.length;
  const N  = Math.max(numTrials, 1);

  // Expected max Sharpe under H0 (returns are N(0, var)) given N independent trials
  const expMaxSr =
    Math.SQRT2 *
    Math.sqrt(2 * Math.log(N)) *
    (1 - EULER_MASCHERONI / Math.sqrt(2 * Math.log(N)));

  // Variance of estimated Sharpe (Mertens 2002)
  const varSr =
    (1 - sk * observedSharpe + ((kt - 1) / 4) * observedSharpe ** 2) / (T - 1);
  if (varSr <= 0) return observedSharpe > 0 ? 1 : 0;

  const z = (observedSharpe - expMaxSr) / Math.sqrt(varSr);
  return normCdf(z);
}

// White's Reality Check (2000) — bootstrap to test whether the best of N strategies
// beats benchmark by more than chance. Uses block-bootstrap of returns.
export function whitesRealityCheck(
  bestStrategyReturns: number[],
  benchmarkReturns: number[],
  bootstrapIters = 500,
  blockSize = 5,
): number {
  if (bestStrategyReturns.length === 0 || benchmarkReturns.length === 0) return 1;
  const T = Math.min(bestStrategyReturns.length, benchmarkReturns.length);
  const diffs = new Array(T);
  for (let i = 0; i < T; i++) diffs[i] = bestStrategyReturns[i] - benchmarkReturns[i];

  const observedMean = mean(diffs);
  // Center the diffs (null hypothesis: mean = 0)
  const centered = diffs.map((d) => d - observedMean);

  let countExceed = 0;
  for (let b = 0; b < bootstrapIters; b++) {
    let bootMean = 0;
    let i = 0;
    while (i < T) {
      const start = Math.floor(Math.random() * (T - blockSize + 1));
      for (let k = 0; k < blockSize && i < T; k++, i++) bootMean += centered[start + k];
    }
    bootMean /= T;
    if (bootMean >= observedMean) countExceed++;
  }
  return countExceed / bootstrapIters;
}

// Probability of Backtest Overfitting (BDH 2016) — combinatorial cross-validation.
//   Splits returns into S buckets, picks the best on half (IS), checks rank on other half (OOS).
//   PBO = fraction of cases where the IS-best does worse than median OOS.
export function probabilityOfBacktestOverfitting(
  trialReturnsMatrix: number[][], // [trial][period_return]
  buckets = 8,
): number {
  if (trialReturnsMatrix.length < 2) return 0;
  const N = trialReturnsMatrix.length;
  const T = trialReturnsMatrix[0].length;
  if (T < buckets * 2) return 0;

  const blockLen = Math.floor(T / buckets);
  // Split each trial into bucket-mean vector
  const bucketReturns: number[][] = trialReturnsMatrix.map((r) => {
    const out: number[] = [];
    for (let b = 0; b < buckets; b++) {
      const slice = r.slice(b * blockLen, (b + 1) * blockLen);
      out.push(mean(slice));
    }
    return out;
  });

  let logitSum = 0;
  let combos = 0;
  // Iterate combinations of half the buckets as IS
  const halves = combinations(buckets, Math.floor(buckets / 2));
  for (const isSet of halves) {
    const oosSet = Array.from({ length: buckets }, (_, i) => i).filter((i) => !isSet.includes(i));
    // Each trial: mean of IS buckets and OOS buckets
    const isMeans  = bucketReturns.map((r) => mean(isSet.map((i)  => r[i])));
    const oosMeans = bucketReturns.map((r) => mean(oosSet.map((i) => r[i])));

    // Best trial in-sample
    let bestIs = 0;
    for (let i = 1; i < N; i++) if (isMeans[i] > isMeans[bestIs]) bestIs = i;

    // Rank of bestIs in OOS, normalized to (0,1)
    const sortedOos = [...oosMeans].sort((a, b) => a - b);
    const rank = sortedOos.indexOf(oosMeans[bestIs]) / (N - 1 || 1);
    const w = Math.max(rank, 1e-9);
    const logit = Math.log(w / (1 - w + 1e-9));
    logitSum += logit < 0 ? 1 : 0;
    combos++;
  }
  return combos > 0 ? logitSum / combos : 0;
}

function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const arr: number[] = [];
  function helper(start: number) {
    if (arr.length === k) { out.push([...arr]); return; }
    for (let i = start; i < n; i++) {
      arr.push(i);
      helper(i + 1);
      arr.pop();
    }
  }
  helper(0);
  return out;
}

export function computeRobustness(
  trades: SimulatedTrade[],
  numTrialsTested: number,
  trialReturnsMatrix?: number[][],
  benchmarkReturns?: number[],
): RobustnessStats {
  const tradeReturns = trades.map((t) => t.pnlPct);
  const m = mean(tradeReturns);
  const s = stddev(tradeReturns);
  const sharpe = s === 0 ? 0 : (m / s) * Math.sqrt(252);
  const dsr = deflatedSharpe(tradeReturns, sharpe, numTrialsTested);

  const sk = skewness(tradeReturns);
  const kt = kurtosis(tradeReturns);

  const pbo = trialReturnsMatrix && trialReturnsMatrix.length >= 2
    ? probabilityOfBacktestOverfitting(trialReturnsMatrix)
    : 0;

  const whitePvalue = benchmarkReturns && benchmarkReturns.length > 0
    ? whitesRealityCheck(tradeReturns, benchmarkReturns)
    : 1;

  return {
    deflatedSharpe: dsr,
    pbo,
    whitePvalue,
    trialsTested: numTrialsTested,
    skew: sk,
    kurtosis: kt,
  };
}
