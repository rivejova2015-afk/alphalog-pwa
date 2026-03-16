import { describe, it, expect } from 'vitest';
import { computePnlTotals, filterTradesForPnl } from './pnl';
import type { PnlTradeLike } from './pnl';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function closed(pnl: number, exitDate = '2026-01-15'): PnlTradeLike {
  return { pnl, status: 'closed', exit_date: exitDate };
}

function open(pnl: number): PnlTradeLike {
  return { pnl, status: 'open', exit_date: null };
}

// ---------------------------------------------------------------------------
// computePnlTotals
// ---------------------------------------------------------------------------

describe('computePnlTotals', () => {
  it('returns zeros for an empty array', () => {
    const result = computePnlTotals([]);
    expect(result.totalPnl).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.ops).toBe(0);
    expect(result.winRate).toBeNull();
    expect(result.avgPnl).toBeNull();
    expect(result.tradeCount).toBe(0);
  });

  it('computes correct totals for mixed winners and losers', () => {
    const trades: PnlTradeLike[] = [
      closed(200),
      closed(150),
      closed(-100),
      closed(-50),
      closed(300),
    ];
    const result = computePnlTotals(trades);
    expect(result.totalPnl).toBeCloseTo(500);
    expect(result.wins).toBe(3);
    expect(result.losses).toBe(2);
    expect(result.ops).toBe(5);
    expect(result.winRate).toBeCloseTo(60);
    expect(result.tradeCount).toBe(5);
  });

  it('returns winRate = 0 when all trades are losses', () => {
    const trades = [closed(-100), closed(-200), closed(-50)];
    const result = computePnlTotals(trades);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(3);
    expect(result.winRate).toBe(0);
    expect(result.totalPnl).toBeCloseTo(-350);
  });

  it('returns winRate = 100 when all trades are winners', () => {
    const trades = [closed(100), closed(200)];
    const result = computePnlTotals(trades);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(100);
  });

  it('computes correct avgPnl', () => {
    const trades = [closed(100), closed(-50)];
    const result = computePnlTotals(trades);
    // totalPnl = 50, ops = 2
    expect(result.avgPnl).toBeCloseTo(25);
  });

  it('accepts pnl as string values', () => {
    const trades: PnlTradeLike[] = [
      { pnl: '150.50', status: 'closed', exit_date: '2026-01-10' },
      { pnl: '-75.25', status: 'closed', exit_date: '2026-01-11' },
    ];
    const result = computePnlTotals(trades);
    expect(result.totalPnl).toBeCloseTo(75.25);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });

  it('accepts pnl as string with commas (e.g. "1,234.56")', () => {
    const trades: PnlTradeLike[] = [
      { pnl: '1,234.56', status: 'closed', exit_date: '2026-01-10' },
    ];
    const result = computePnlTotals(trades);
    expect(result.totalPnl).toBeCloseTo(1234.56);
    expect(result.wins).toBe(1);
  });

  it('excludes open trades by default (requireExitDate=true)', () => {
    const trades: PnlTradeLike[] = [
      closed(200),
      open(500),   // should be excluded
    ];
    const result = computePnlTotals(trades);
    expect(result.tradeCount).toBe(1);
    expect(result.totalPnl).toBeCloseTo(200);
  });

  it('excludes trades with null pnl', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      { pnl: null, status: 'closed', exit_date: '2026-01-10' },
    ];
    const result = computePnlTotals(trades);
    expect(result.tradeCount).toBe(1);
  });

  it('excludes zero-pnl trades by default (ignoreZero=true)', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      closed(0),
      closed(-50),
    ];
    const result = computePnlTotals(trades);
    expect(result.tradeCount).toBe(2);
    expect(result.ops).toBe(2);
  });

  it('includes zero-pnl trades when ignoreZero=false', () => {
    const trades: PnlTradeLike[] = [closed(100), closed(0), closed(-50)];
    const result = computePnlTotals(trades, { ignoreZero: false });
    expect(result.tradeCount).toBe(3);
  });

  it('includes open trades when closedOnly=false', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      open(200),
    ];
    const result = computePnlTotals(trades, { closedOnly: false });
    expect(result.tradeCount).toBe(2);
  });

  it('handles single winning trade correctly', () => {
    const result = computePnlTotals([closed(999)]);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(100);
    expect(result.totalPnl).toBeCloseTo(999);
    expect(result.tradeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// filterTradesForPnl
// ---------------------------------------------------------------------------

describe('filterTradesForPnl', () => {
  it('excludes trades without exit_date when requireExitDate=true (default)', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      open(200),
      { pnl: 50, status: 'closed', exit_date: null },
    ];
    const filtered = filterTradesForPnl(trades);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].pnl).toBe(100);
  });

  it('includes trades with status=closed and no exit_date when requireExitDate=false', () => {
    const trades: PnlTradeLike[] = [
      { pnl: 100, status: 'closed', exit_date: null },
      { pnl: 200, status: 'open', exit_date: null },
    ];
    const filtered = filterTradesForPnl(trades, {
      requireExitDate: false,
      closedOnly: true,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].pnl).toBe(100);
  });

  it('excludes trades with null pnl', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      { pnl: null, status: 'closed', exit_date: '2026-01-01' },
    ];
    const filtered = filterTradesForPnl(trades);
    expect(filtered).toHaveLength(1);
  });

  it('excludes zero-pnl trades by default', () => {
    const trades = [closed(50), closed(0), closed(-25)];
    const filtered = filterTradesForPnl(trades);
    expect(filtered).toHaveLength(2);
  });

  it('returns all trades when given empty array', () => {
    expect(filterTradesForPnl([])).toHaveLength(0);
  });

  it('handles non-finite numeric pnl (NaN, Infinity) by excluding them', () => {
    const trades: PnlTradeLike[] = [
      closed(100),
      { pnl: NaN, status: 'closed', exit_date: '2026-01-10' },
      { pnl: Infinity, status: 'closed', exit_date: '2026-01-11' },
    ];
    const filtered = filterTradesForPnl(trades);
    expect(filtered).toHaveLength(1);
  });
});
