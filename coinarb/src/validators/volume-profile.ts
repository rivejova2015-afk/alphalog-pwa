/**
 * Volume profile validator — finds the price level with the most accepted
 * trading activity (Point of Control) and the value area.
 *
 * Stub: ticker streams don't carry trade volume, so we approximate by
 * weighting sample density per price bucket. Replace with REST trades feed
 * (GET /products/{symbol}/trades) when latency budget allows.
 */

import type { PriceSample } from '../feeds/coinbase-ws.js';

export interface VolumeProfileResult {
  poc: number | null;       // Point of Control: most-traded price
  vahigh: number | null;    // Value Area High (70% of activity)
  valow: number | null;
  confidence: number;
}

const BUCKETS = 40;

export function computeVolumeProfile(samples: readonly PriceSample[]): VolumeProfileResult {
  if (samples.length < 50) return { poc: null, vahigh: null, valow: null, confidence: 0 };

  const prices = samples.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max <= min) return { poc: null, vahigh: null, valow: null, confidence: 0 };

  const step = (max - min) / BUCKETS;
  const counts = new Array<number>(BUCKETS).fill(0);
  for (const p of prices) {
    const idx = Math.min(BUCKETS - 1, Math.floor((p - min) / step));
    counts[idx] += 1;
  }

  let pocIdx = 0;
  for (let i = 1; i < BUCKETS; i++) if (counts[i] > counts[pocIdx]) pocIdx = i;
  const poc = min + (pocIdx + 0.5) * step;

  // Value area: expand outward from POC until we cover 70% of samples
  const target = Math.floor(prices.length * 0.7);
  let acc = counts[pocIdx];
  let lo = pocIdx;
  let hi = pocIdx;
  while (acc < target && (lo > 0 || hi < BUCKETS - 1)) {
    const left = lo > 0 ? counts[lo - 1] : -1;
    const right = hi < BUCKETS - 1 ? counts[hi + 1] : -1;
    if (right >= left) { hi += 1; acc += counts[hi]; }
    else { lo -= 1; acc += counts[lo]; }
  }

  return {
    poc,
    valow: min + lo * step,
    vahigh: min + (hi + 1) * step,
    confidence: Math.min(prices.length / 500, 1),
  };
}

export function priceInValueArea(price: number, vp: VolumeProfileResult): boolean {
  if (vp.valow === null || vp.vahigh === null) return true;
  return price >= vp.valow && price <= vp.vahigh;
}
