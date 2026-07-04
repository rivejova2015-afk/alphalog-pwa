/**
 * Paper trading broker for Coinbase spot.
 *
 * Mirrors the API surface used by the loop's order flow:
 *   placeMarket({ symbol, side, sizeUsd }) → { orderId, fillPrice, feeUsd }
 *
 * Fills at the supplied mark price, charges Coinbase taker fee (60 bps), and
 * tracks a paper balance per quote currency so closeAll math stays sane.
 */

import type { Symbol } from '../core/config.js';

const TAKER_FEE_BPS = 60; // 0.60% Coinbase Advanced taker

export interface PaperFill {
  orderId: string;
  fillPrice: number;
  baseQty: number;
  quoteQty: number;
  feeUsd: number;
  ts: number;
}

export class PaperSpotBroker {
  private balance: number;
  private orderSeq = 0;

  constructor(startingUsd = 100) {
    this.balance = startingUsd;
  }

  get balanceUsd(): number { return this.balance; }

  reset(usd: number): void { this.balance = usd; this.orderSeq = 0; }

  /**
   * Market BUY: spend `sizeUsd` to acquire base.
   * Market SELL: sell `sizeUsd` worth of base (closing a long, or opening a short).
   * `purpose: 'open'` (default) gates the fill on available balance — this
   * applies to BOTH sides, since opening a short still needs collateral to
   * back the eventual buy-back. `purpose: 'close'` never gates: unwinding a
   * position you already hold must always be allowed, even if fee drag has
   * pushed `balance` below the notional.
   * Returns null on insufficient balance (opens only).
   */
  placeMarket(params: {
    symbol: Symbol;
    side: 'BUY' | 'SELL';
    sizeUsd: number;
    markPrice: number;
    purpose?: 'open' | 'close';
  }): PaperFill | null {
    const { symbol, side, sizeUsd, markPrice, purpose = 'open' } = params;
    if (markPrice <= 0 || sizeUsd <= 0) return null;

    const fillPrice = markPrice;
    const baseQty = sizeUsd / fillPrice;
    const feeUsd = (sizeUsd * TAKER_FEE_BPS) / 10_000;

    if (purpose === 'open' && this.balance < sizeUsd + feeUsd) {
      console.warn(`[paper-broker] insufficient balance to open ${side}: have ${this.balance}, need ${sizeUsd + feeUsd}`);
      return null;
    }
    if (side === 'BUY') {
      this.balance -= (sizeUsd + feeUsd);
    } else {
      this.balance += (sizeUsd - feeUsd);
    }

    this.orderSeq += 1;
    const orderId = `paper-${symbol}-${Date.now()}-${this.orderSeq}`;

    return {
      orderId,
      fillPrice,
      baseQty,
      quoteQty: sizeUsd,
      feeUsd,
      ts: Date.now(),
    };
  }
}
