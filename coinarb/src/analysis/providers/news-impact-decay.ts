/**
 * B2 — News Impact Decay (Personalized)
 *
 * The News Scanner uses a fixed 45-min linear decay for all headlines.
 * Reality: "ETF inflow" impacts BTC for hours. "Hack" reverts in 20 min.
 *
 * This engine tracks, per headline type, how long the impact historically lasted
 * and applies a personalized exponential decay: score × exp(-age / tau).
 *
 * Refreshes every 6h by comparing past headlines vs BTC price moves.
 */

export interface NewsImpactDecaySignal {
  decayModel: Record<string, number>; // headline_type → tau in minutes
  adjustedScore: number;              // score with type-specific decay applied
  modelConfidence: 'HIGH' | 'MEDIUM' | 'LOW'; // based on sample size
  fetchedAt: number;
}

// Default tau per headline type (minutes) — used before enough history
const DEFAULT_TAU: Record<string, number> = {
  ETF_INFLOW:   120,   // ETF news lasts ~2h
  ETF_OUTFLOW:   90,
  HACK:          20,   // hacks fade fast (market absorbs)
  ATH:          180,   // all-time high momentum persists
  CRASH:         30,
  REGULATION:   240,   // regulatory news can last 4h
  HALVING:      480,   // halving narrative is days-long
  DEFAULT:       45,   // matches existing linear fallback
};

// Simple keyword → type classifier
function classifyHeadline(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('etf') && (t.includes('inflow') || t.includes('buy'))) return 'ETF_INFLOW';
  if (t.includes('etf') && (t.includes('outflow') || t.includes('sell'))) return 'ETF_OUTFLOW';
  if (t.includes('hack') || t.includes('exploit') || t.includes('breach')) return 'HACK';
  if (t.includes('all-time high') || t.includes('ath') || t.includes('record')) return 'ATH';
  if (t.includes('crash') || t.includes('collapse') || t.includes('plunge')) return 'CRASH';
  if (t.includes('ban') || t.includes('regulat') || t.includes('sec') || t.includes('cftc')) return 'REGULATION';
  if (t.includes('halving') || t.includes('halvening')) return 'HALVING';
  return 'DEFAULT';
}

export class NewsImpactDecayProvider {
  private decayModel: Record<string, number> = { ...DEFAULT_TAU };
  private cached: NewsImpactDecaySignal | null = null;
  private lastModelUpdate = 0;
  private readonly MODEL_UPDATE_INTERVAL = 6 * 60 * 60_000; // 6h

  get(): NewsImpactDecaySignal | null {
    return this.cached;
  }

  /**
   * Called by FundamentalEngine after NewsScanner produces headlines.
   * Applies personalized decay to each scored headline.
   */
  applyPersonalizedDecay(
    headlines: Array<{ title: string; score: number; ageMs: number }>,
  ): number {
    if (headlines.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const h of headlines) {
      const type = classifyHeadline(h.title);
      const tau = this.decayModel[type] ?? this.decayModel.DEFAULT ?? 45;
      const ageMin = h.ageMs / 60_000;

      // Exponential decay with type-specific half-life
      const decayFactor = Math.exp(-ageMin / tau);
      const weight = decayFactor;

      weightedSum += h.score * decayFactor;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 0;
    const raw = weightedSum / totalWeight * 10; // scale
    return Math.max(-30, Math.min(30, raw));
  }

  /**
   * Update decay model from BTC price history vs headline types.
   * Simple heuristic: measure price reversion time after headline types.
   * Called rarely (every 6h) to avoid computation overhead.
   */
  updateModelFromPriceHistory(
    priceHistory: Array<{ price: number; ts: number }>,
    headlineLog: Array<{ title: string; ts: number; score: number }>,
  ): void {
    const now = Date.now();
    if (now - this.lastModelUpdate < this.MODEL_UPDATE_INTERVAL) return;
    this.lastModelUpdate = now;

    const typeImpacts: Record<string, number[]> = {};

    for (const h of headlineLog) {
      const type = classifyHeadline(h.title);
      if (!typeImpacts[type]) typeImpacts[type] = [];

      // Find price at headline time and then measure how long the move lasted
      const priceAtEvent = priceHistory.find(p => Math.abs(p.ts - h.ts) < 5 * 60_000);
      if (!priceAtEvent) continue;

      const direction = h.score > 0 ? 1 : -1;
      let impactDurationMin = DEFAULT_TAU[type] ?? 45;

      // Find when price reverted past midpoint
      for (const p of priceHistory) {
        if (p.ts <= h.ts) continue;
        const priceChange = (p.price - priceAtEvent.price) / priceAtEvent.price;
        const minutesElapsed = (p.ts - h.ts) / 60_000;

        if (direction * priceChange < 0) {
          // Price reversed direction — impact lasted until here
          impactDurationMin = minutesElapsed;
          break;
        }
      }

      typeImpacts[type].push(impactDurationMin);
    }

    // Update model with observed durations
    for (const [type, durations] of Object.entries(typeImpacts)) {
      if (durations.length < 3) continue; // need at least 3 samples
      const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
      // Blend with default: 70% observed, 30% prior
      this.decayModel[type] = 0.7 * avg + 0.3 * (DEFAULT_TAU[type] ?? 45);
    }

    const totalSamples = Object.values(typeImpacts).reduce((s, v) => s + v.length, 0);
    this.cached = {
      decayModel: { ...this.decayModel },
      adjustedScore: 0,
      modelConfidence: totalSamples >= 20 ? 'HIGH' : totalSamples >= 5 ? 'MEDIUM' : 'LOW',
      fetchedAt: now,
    };
  }
}
