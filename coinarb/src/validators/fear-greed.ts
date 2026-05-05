/**
 * Fear & Greed Index — telemetry only (no longer gates entries).
 *
 * The pure SMC pipeline does not filter on F&G. We still poll it to write the
 * `fear_greed_index` column on telemetry rows so the dashboard can chart
 * sentiment context next to trades.
 *
 * Source: alternative.me /fng/?limit=1 (free, no auth, cached for 5 min).
 */

const FNG_URL = 'https://api.alternative.me/fng/?limit=1';
const CACHE_MS = 5 * 60 * 1000;

let cache: { value: number; classification: string; ts: number } | null = null;

export interface FearGreedResult {
  allow: boolean;          // Always true — kept for backward compatibility
  value: number;
  classification: string;
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
    allow: true,
    value: cache.value,
    classification: cache.classification,
  };
}
