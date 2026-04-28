import type { Bar } from '@/types/backtest';

export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function rsi(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function atr(bars: Bar[], period: number): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  if (period <= 0 || bars.length <= period) return out;
  const tr: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;
  for (let i = period + 1; i < bars.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

export function bbands(values: number[], period: number, std = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const upper: number[] = new Array(values.length).fill(NaN);
  const lower: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += (values[k] - middle[i]) ** 2;
    const dev = Math.sqrt(sum / period);
    upper[i] = middle[i] + std * dev;
    lower[i] = middle[i] - std * dev;
  }
  return { upper, middle, lower };
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; hist: number[] } {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const m: number[] = ef.map((v, i) => v - es[i]);
  const s = ema(m.map((v) => (Number.isFinite(v) ? v : 0)), signal);
  const h = m.map((v, i) => v - s[i]);
  return { macd: m, signal: s, hist: h };
}
