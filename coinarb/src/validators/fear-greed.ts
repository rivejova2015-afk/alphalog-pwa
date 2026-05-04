/**
 * Fear & Greed Index gate.
 *
 * Bot trades ONLY when F&G >= 65 (Greed/Extreme Greed) per spec.
 * The previous polymarket-era provider had a contrarian read; we ignore that
 * and use the raw value with a hard threshold.
 *
 * Source: alternative.me /fng/?limit=1 (free, no auth, cached for 5 min).
 */

import { FEAR_GREED_GATE } from '../core/config.js';

const FNG_URL = 'https://api.alternative.me/fng/?limit=1';
const CACHE_MS = 5 * 60 * 1000;

let cache: { value: number; classification: string; ts: number } | null = null;

export interface FearGreedResult {
  allow: boolean;
  value: number;
  classification: string;
  threshold: number;
}

export async function checkFearGreed(): Promise<FearGreedResult> {
  const now = Date.now();
  if (!cache || now - cache.ts > CACHE_MS) {
    try {
      const res = await fetch(FNG_URL);
      if (!res.ok) throw new Error(`F&G API ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ value: string; value_classification: string }> };
      const entry = json.data?.[0];
      if (!entry) throw new Error('F&G API empty payload');
      cache = {
        value: parseInt(entry.value, 10),
        classification: entry.value_classification,
        ts: now,
      };
    } catch (err) {
      console.error('[fear-greed] fetch failed, using stale or 50:', err);
      cache = cache ?? { value: 50, classification: 'Neutral', ts: now };
    }
  }

  return {
    allow: cache.value >= FEAR_GREED_GATE,
    value: cache.value,
    classification: cache.classification,
    threshold: FEAR_GREED_GATE,
  };
}
