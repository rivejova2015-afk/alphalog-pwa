/**
 * Funding-rate gate for perp entries.
 *
 * Coinbase International funds long ↔ short every hour. Positive funding
 * means longs pay shorts. If our directional thesis aligns with the side that
 * is *paying*, the funding cost erodes edge — skip the entry above threshold.
 */

import type { CoinbaseIntxFeed } from '../feeds/coinbase-intx-ws.js';

export type Side = 'BUY' | 'SELL';

export interface FundingDecision {
  allowed: boolean;
  ratePerHour: number;
  reason: string;
}

export class FundingGate {
  constructor(
    private readonly intxFeed: CoinbaseIntxFeed,
    private readonly adverseThreshold: number,
  ) {}

  /**
   * @param symbol  perp symbol, e.g. 'BTC-PERP'
   * @param side    intended order side
   * @returns       whether the entry is allowed under current funding regime
   */
  check(symbol: string, side: Side): FundingDecision {
    const f = this.intxFeed.getFunding(symbol);
    if (!f) {
      return { allowed: true, ratePerHour: 0, reason: 'no funding data — allow' };
    }

    // Positive funding rate → longs pay shorts. If we're long and rate ≥ threshold, skip.
    // Negative funding rate → shorts pay longs. If we're short and |rate| ≥ threshold, skip.
    const adverseForLong = f.ratePerHour >= this.adverseThreshold;
    const adverseForShort = f.ratePerHour <= -this.adverseThreshold;

    if (side === 'BUY' && adverseForLong) {
      return {
        allowed: false,
        ratePerHour: f.ratePerHour,
        reason: `long pays ${(f.ratePerHour * 100).toFixed(4)}%/h ≥ threshold`,
      };
    }
    if (side === 'SELL' && adverseForShort) {
      return {
        allowed: false,
        ratePerHour: f.ratePerHour,
        reason: `short pays ${(Math.abs(f.ratePerHour) * 100).toFixed(4)}%/h ≥ threshold`,
      };
    }

    return {
      allowed: true,
      ratePerHour: f.ratePerHour,
      reason: 'funding favorable or neutral',
    };
  }
}
