/**
 * Volume delta validator — measures buy vs sell pressure from recent ticks.
 *
 * Approximates aggressive-buy/sell volume using uptick/downtick of the last
 * mark prints (ticker stream lacks taker side, so we use price direction as
 * a proxy). Returns a normalized signed delta in [-1, 1].
 */

import type { PriceSample } from '../feeds/coinbase-ws.js';

export interface VolumeDeltaResult {
  delta: number;        // [-1, 1]; +1 = strong buying, -1 = strong selling
  upticks: number;
  downticks: number;
  windowSamples: number;
  confidence: number;   // 0-1, scales with sample count
}

const MIN_SAMPLES = 30;
const TARGET_SAMPLES = 200;

export function computeVolumeDelta(samples: readonly PriceSample[], windowMs = 5 * 60_000): VolumeDeltaResult {
  if (samples.length < 2) {
    return { delta: 0, upticks: 0, downticks: 0, windowSamples: 0, confidence: 0 };
  }
  const cutoff = Date.now() - windowMs;
  const window = samples.filter((s) => s.timestamp >= cutoff);
  if (window.length < 2) {
    return { delta: 0, upticks: 0, downticks: 0, windowSamples: window.length, confidence: 0 };
  }

  let upticks = 0;
  let downticks = 0;
  for (let i = 1; i < window.length; i++) {
    const diff = window[i].price - window[i - 1].price;
    if (diff > 0) upticks += 1;
    else if (diff < 0) downticks += 1;
  }

  const total = upticks + downticks;
  const delta = total > 0 ? (upticks - downticks) / total : 0;
  const confidence = Math.min(window.length / TARGET_SAMPLES, 1);

  return {
    delta,
    upticks,
    downticks,
    windowSamples: window.length,
    confidence: window.length < MIN_SAMPLES ? 0 : confidence,
  };
}

export function deltaAgreesWith(direction: 'BUY' | 'SELL', delta: number, threshold = 0.2): boolean {
  if (direction === 'BUY') return delta >= threshold;
  return delta <= -threshold;
}
