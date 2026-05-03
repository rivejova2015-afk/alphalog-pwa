/**
 * Fear & Greed Provider — Alternative.me public API.
 *
 * No API key. No rate limit concerns at 10-minute refresh.
 * Contrarian logic: extreme fear = smart accumulation zone (bullish edge).
 *                   extreme greed = market top risk (bearish edge).
 *
 * Score range: -25 to +25 (contribution to composite).
 */

import type { FearGreedComponent } from '../types.js';

const URL = 'https://api.alternative.me/fng/?limit=2';
const TTL_MS = 10 * 60_000;   // refresh every 10 minutes

export class FearGreedProvider {
  private cached: FearGreedComponent | null = null;
  private fetching = false;

  get(): FearGreedComponent | null {
    return this.cached;
  }

  async refresh(): Promise<void> {
    if (this.fetching) return;
    if (this.cached && Date.now() - this.cached.fetchedAt < TTL_MS) return;
    this.fetching = true;
    try {
      const res = await fetch(URL, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return;

      const json = await res.json() as {
        data?: Array<{ value: string; value_classification: string }>;
      };
      const entry = json.data?.[0];
      if (!entry) return;

      const value = parseInt(entry.value, 10);
      if (isNaN(value)) return;

      const label = entry.value_classification;

      // Contrarian signal table
      let signal: FearGreedComponent['signal'];
      let score: number;

      if (value <= 20) {
        // Extreme Fear: historically a strong buy zone — market oversold
        signal = 'BULLISH';
        score = 25;
      } else if (value <= 40) {
        // Fear: mild bullish bias
        signal = 'BULLISH';
        score = 12;
      } else if (value <= 60) {
        // Neutral: no directional edge from this signal
        signal = 'NEUTRAL';
        score = 0;
      } else if (value <= 80) {
        // Greed: mild bearish bias — market overextended
        signal = 'BEARISH';
        score = -12;
      } else {
        // Extreme Greed: strong mean-reversion risk — be cautious on longs
        signal = 'BEARISH';
        score = -25;
      }

      this.cached = { value, label, signal, score, fetchedAt: Date.now() };
      console.log(`[fear-greed] F&G=${value} (${label}) → ${signal} score=${score}`);
    } catch (err) {
      console.warn('[fear-greed] Fetch failed (using stale):', err instanceof Error ? err.message : String(err));
    } finally {
      this.fetching = false;
    }
  }
}
