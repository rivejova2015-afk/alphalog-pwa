// PaperSpotBroker — the solvency gate must apply to OPENING a position on
// either side (BUY or SELL/short); it must never block CLOSING one.
// Regression coverage for the SELL-accounting bug: opening a SELL used to
// credit cash unconditionally with no balance check, letting concurrent
// shorts inflate `balance` with nothing backing them.

import { describe, it, expect } from 'vitest';
import { PaperSpotBroker } from '../src/paper/paper-spot-broker.js';

describe('PaperSpotBroker', () => {
  it('rejects opening a BUY when balance is insufficient', () => {
    const broker = new PaperSpotBroker(10);
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 60000 });
    expect(fill).toBeNull();
    expect(broker.balanceUsd).toBe(10);
  });

  it('rejects opening a SELL (short) when balance is insufficient (the fix)', () => {
    const broker = new PaperSpotBroker(10);
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'SELL', sizeUsd: 50, markPrice: 60000 });
    expect(fill).toBeNull();
    expect(broker.balanceUsd).toBe(10);
  });

  it('accepts opening a BUY within balance and debits sizeUsd+fee', () => {
    const broker = new PaperSpotBroker(100);
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 60000 });
    expect(fill).not.toBeNull();
    expect(fill?.feeUsd).toBeCloseTo(0.3, 6); // 60bps of 50
    expect(broker.balanceUsd).toBeCloseTo(100 - 50 - 0.3, 6);
  });

  it('accepts opening a SELL within balance and credits sizeUsd-fee', () => {
    const broker = new PaperSpotBroker(100);
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'SELL', sizeUsd: 50, markPrice: 60000 });
    expect(fill).not.toBeNull();
    expect(broker.balanceUsd).toBeCloseTo(100 + 50 - 0.3, 6);
  });

  it('never blocks closing a position, even if balance is below the notional', () => {
    const broker = new PaperSpotBroker(10);
    // Closing a long (side=SELL here represents unwinding a BUY) must always
    // succeed regardless of the solvency gate.
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'SELL', sizeUsd: 50, markPrice: 60000, purpose: 'close' });
    expect(fill).not.toBeNull();
    expect(broker.balanceUsd).toBeCloseTo(10 + 50 - 0.3, 6);
  });

  it('never blocks closing a short (BUY-to-close), even if balance is below the notional', () => {
    const broker = new PaperSpotBroker(10);
    const fill = broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 60000, purpose: 'close' });
    expect(fill).not.toBeNull();
    expect(broker.balanceUsd).toBeCloseTo(10 - 50 - 0.3, 6);
  });

  it('round-trip BUY-open + SELL-close nets to -2x fee', () => {
    const broker = new PaperSpotBroker(100);
    broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 60000 });
    broker.placeMarket({ symbol: 'BTC-USD', side: 'SELL', sizeUsd: 50, markPrice: 61000, purpose: 'close' });
    expect(broker.balanceUsd).toBeCloseTo(100 - 2 * 0.3, 6);
  });

  it('round-trip SELL-open + BUY-close nets to -2x fee', () => {
    const broker = new PaperSpotBroker(100);
    broker.placeMarket({ symbol: 'BTC-USD', side: 'SELL', sizeUsd: 50, markPrice: 60000 });
    broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 59000, purpose: 'close' });
    expect(broker.balanceUsd).toBeCloseTo(100 - 2 * 0.3, 6);
  });

  it('reset() restores balance and order sequence', () => {
    const broker = new PaperSpotBroker(100);
    broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 60000 });
    broker.reset(250);
    expect(broker.balanceUsd).toBe(250);
  });

  it('rejects a fill with non-positive price or size', () => {
    const broker = new PaperSpotBroker(100);
    expect(broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 0, markPrice: 60000 })).toBeNull();
    expect(broker.placeMarket({ symbol: 'BTC-USD', side: 'BUY', sizeUsd: 50, markPrice: 0 })).toBeNull();
  });
});
