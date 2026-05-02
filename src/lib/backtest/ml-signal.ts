// ML signal: logistic regression that learns "is this bar a profitable LONG entry?"
// Trained on past bars with features (RSI, ATR, regime, hour-of-day) → binary label.
// Output: P(profitable_long | features) ∈ [0, 1].
//
// This is a real, trainable classifier in pure TypeScript. It's deliberately
// simple (no L2 reg, no early stopping) so it converges fast and you can
// retrain on every walk-forward window. For richer models (XGBoost/LightGBM)
// you'd export training to Python or load an ONNX runtime — see `ml-onnx.ts`
// for the interface stub.

import type { Bar } from "@/types/backtest";

export interface FeatureVector {
  rsi14: number;
  atr14: number;
  emaSlope20: number;
  hourOfDay: number;
  bodyRatio: number;     // |close - open| / (high - low)
  upperWickRatio: number;
  lowerWickRatio: number;
}

export interface MlModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  featureNames: string[];
  trainAcc: number;
  validAcc: number;
}

export function extractFeatures(bars: Bar[]): FeatureVector[] {
  const n = bars.length;
  const feats: FeatureVector[] = [];

  // Pre-compute closes, highs, lows for indicators
  const closes = bars.map((b) => b.close);
  const highs  = bars.map((b) => b.high);
  const lows   = bars.map((b) => b.low);

  const rsi = rsiSeries(closes, 14);
  const atr = atrSeries(highs, lows, closes, 14);
  const ema = emaSeries(closes, 20);

  for (let i = 0; i < n; i++) {
    const range = bars[i].high - bars[i].low;
    const body  = Math.abs(bars[i].close - bars[i].open);
    const upperWick = bars[i].high - Math.max(bars[i].open, bars[i].close);
    const lowerWick = Math.min(bars[i].open, bars[i].close) - bars[i].low;
    feats.push({
      rsi14:  rsi[i],
      atr14:  atr[i],
      emaSlope20: i > 0 && ema[i - 1] > 0 ? ema[i] / ema[i - 1] - 1 : 0,
      hourOfDay: new Date(bars[i].ts).getUTCHours(),
      bodyRatio:       range > 0 ? body / range : 0,
      upperWickRatio:  range > 0 ? upperWick / range : 0,
      lowerWickRatio:  range > 0 ? lowerWick / range : 0,
    });
  }
  return feats;
}

// Label: bar i is "profitable long" if close[i + horizon] > close[i] * (1 + threshold)
export function buildLabels(bars: Bar[], horizon = 10, threshold = 0.001): number[] {
  const labels: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i + horizon >= bars.length) { labels.push(0); continue; }
    labels.push(bars[i + horizon].close > bars[i].close * (1 + threshold) ? 1 : 0);
  }
  return labels;
}

const FEATURE_KEYS: (keyof FeatureVector)[] = [
  "rsi14", "atr14", "emaSlope20", "hourOfDay", "bodyRatio", "upperWickRatio", "lowerWickRatio",
];

export function trainModel(
  features: FeatureVector[],
  labels: number[],
  opts: { epochs?: number; lr?: number; validationSplit?: number } = {},
): MlModel {
  const epochs = opts.epochs ?? 200;
  const lr = opts.lr ?? 0.05;
  const valSplit = opts.validationSplit ?? 0.2;

  const X = features.map((f) => FEATURE_KEYS.map((k) => f[k] as number));
  const y = labels;

  // z-score normalize
  const dim = X[0]?.length ?? FEATURE_KEYS.length;
  const means = new Array(dim).fill(0);
  const stds  = new Array(dim).fill(1);
  for (let j = 0; j < dim; j++) {
    let s = 0;
    for (let i = 0; i < X.length; i++) s += X[i][j];
    means[j] = s / X.length;
    let v = 0;
    for (let i = 0; i < X.length; i++) v += (X[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(v / X.length) || 1;
  }
  const Xn = X.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));

  const splitIdx = Math.floor(Xn.length * (1 - valSplit));
  const Xtr = Xn.slice(0, splitIdx), ytr = y.slice(0, splitIdx);
  const Xva = Xn.slice(splitIdx),     yva = y.slice(splitIdx);

  // Logistic regression: weights initialized to zero, gradient descent
  const w = new Array(dim).fill(0);
  let b = 0;

  for (let e = 0; e < epochs; e++) {
    const gw = new Array(dim).fill(0);
    let gb = 0;
    for (let i = 0; i < Xtr.length; i++) {
      let z = b;
      for (let j = 0; j < dim; j++) z += w[j] * Xtr[i][j];
      const p = 1 / (1 + Math.exp(-z));
      const err = p - ytr[i];
      for (let j = 0; j < dim; j++) gw[j] += err * Xtr[i][j];
      gb += err;
    }
    const m = Xtr.length || 1;
    for (let j = 0; j < dim; j++) w[j] -= (lr * gw[j]) / m;
    b -= (lr * gb) / m;
  }

  const acc = (X: number[][], y: number[]) => {
    if (X.length === 0) return 0;
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      let z = b;
      for (let j = 0; j < dim; j++) z += w[j] * X[i][j];
      const p = 1 / (1 + Math.exp(-z));
      const pred = p > 0.5 ? 1 : 0;
      if (pred === y[i]) correct++;
    }
    return correct / X.length;
  };

  return {
    weights: w,
    bias: b,
    featureMeans: means,
    featureStds: stds,
    featureNames: FEATURE_KEYS as string[],
    trainAcc: +acc(Xtr, ytr).toFixed(3),
    validAcc: +acc(Xva, yva).toFixed(3),
  };
}

export function predict(model: MlModel, f: FeatureVector): number {
  const x = FEATURE_KEYS.map((k, j) => ((f[k] as number) - model.featureMeans[j]) / model.featureStds[j]);
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) z += model.weights[j] * x[j];
  return 1 / (1 + Math.exp(-z));
}

// ---- helpers (kept private) ----
function rsiSeries(closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(50);
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gainSum += d; else lossSum -= d;
  }
  let avgG = gainSum / period, avgL = lossSum / period;
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const d = closes[i] - closes[i - 1];
      const g = d > 0 ? d : 0;
      const l = d < 0 ? -d : 0;
      avgG = (avgG * (period - 1) + g) / period;
      avgL = (avgL * (period - 1) + l) / period;
    }
    const rs = avgL === 0 ? 100 : avgG / avgL;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function atrSeries(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(0);
  const trs: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trs.push(tr);
  }
  let sum = 0;
  for (let i = 1; i <= period && i < trs.length; i++) sum += trs[i];
  out[period] = sum / period;
  for (let i = period + 1; i < trs.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

function emaSeries(closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(0);
  const k = 2 / (period + 1);
  out[0] = closes[0];
  for (let i = 1; i < closes.length; i++) out[i] = closes[i] * k + out[i - 1] * (1 - k);
  return out;
}
