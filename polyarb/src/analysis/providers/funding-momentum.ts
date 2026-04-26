/**
 * B1 — Funding Rate Momentum
 *
 * Extends DerivativesProvider with velocity + acceleration of the funding rate.
 * DerivativesProvider gives the current funding rate (contrarian signal).
 * This engine detects HOW FAST it's changing — a rapidly rising rate signals
 * a liquidation cascade is imminent, which is actionable BEFORE it happens.
 *
 * Score range: -25 to +25 (contribution to compositeScore).
 */

export interface FundingMomentumSignal {
  fundingVelocity: number;              // change per minute (%)
  fundingHistory: number[];             // last 6 readings
  cascadeRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;                        // -25 to +25
  confidence: number;
  fetchedAt: number;
}

const CASCADE_HIGH_THRESHOLD   = 0.00005; // 0.005% / min velocity
const CASCADE_MEDIUM_THRESHOLD = 0.00002;
const HISTORY_SIZE = 6; // 6 readings × ~1 min refresh = 6 min of data

export class FundingMomentumProvider {
  private history: { rate: number; ts: number }[] = [];
  private cached: FundingMomentumSignal | null = null;

  get(): FundingMomentumSignal | null {
    return this.cached;
  }

  /** Called by FundamentalEngine every time DerivativesProvider refreshes. */
  recordFundingRate(rate: number): void {
    const now = Date.now();
    this.history.push({ rate, ts: now });
    // Keep only last HISTORY_SIZE readings
    if (this.history.length > HISTORY_SIZE) this.history.shift();
    this.cached = this.compute();
  }

  private compute(): FundingMomentumSignal {
    const now = Date.now();
    const rates = this.history.map(h => h.rate);

    if (rates.length < 2) {
      return {
        fundingVelocity: 0,
        fundingHistory: rates,
        cascadeRisk: 'LOW',
        signal: 'NEUTRAL',
        score: 0,
        confidence: 0,
        fetchedAt: now,
      };
    }

    // Velocity: change per minute over the last reading
    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];
    const dtMin = Math.max(0.1, (newest.ts - oldest.ts) / 60_000);
    const fundingVelocity = (newest.rate - oldest.rate) / dtMin;
    const absVel = Math.abs(fundingVelocity);

    let cascadeRisk: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (absVel > CASCADE_HIGH_THRESHOLD)   cascadeRisk = 'HIGH';
    else if (absVel > CASCADE_MEDIUM_THRESHOLD) cascadeRisk = 'MEDIUM';

    // BULLISH: funding accelerating toward negative (shorts will be liquidated)
    // BEARISH: funding accelerating toward positive (longs will be liquidated)
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let score = 0;

    if (cascadeRisk !== 'LOW') {
      if (fundingVelocity < 0 && newest.rate < 0) {
        signal = 'BULLISH';
        score = cascadeRisk === 'HIGH' ? 25 : 12;
      } else if (fundingVelocity > 0 && newest.rate > 0) {
        signal = 'BEARISH';
        score = cascadeRisk === 'HIGH' ? -25 : -12;
      } else if (fundingVelocity < 0) {
        signal = 'BULLISH';
        score = cascadeRisk === 'HIGH' ? 15 : 6;
      } else {
        signal = 'BEARISH';
        score = cascadeRisk === 'HIGH' ? -15 : -6;
      }
    }

    const confidence = cascadeRisk === 'HIGH' ? 0.8
      : cascadeRisk === 'MEDIUM' ? 0.5
      : 0;

    return {
      fundingVelocity,
      fundingHistory: rates,
      cascadeRisk,
      signal,
      score,
      confidence,
      fetchedAt: now,
    };
  }
}
