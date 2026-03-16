import { describe, it, expect } from 'vitest';
import {
  computeCycleStart,
  computeCycleExpectedEnd,
  getCycleInfo,
  calculatePeriodPnL,
  calculateRetirableFromPeriod,
  calculatePayoutBreakdown,
  isPayoutCreatable,
  shouldSendThresholdPush,
  getNextVersion,
} from './payoutEngine';
import type { Account, TreasuryConfig, Trade } from './calculations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    name: 'Test Account',
    account_size: 10000,
    current_balance: 12000,
    withdrawals_enabled: true,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<TreasuryConfig> = {}): TreasuryConfig {
  return {
    account_id: 'acc-1',
    withdrawal_day: 15,
    split_mode: 'growth',
    anti_drawdown_active: false,
    anti_drawdown_threshold: 20,
    tax_buffer_percentage: 30,
    tax_buffer_accumulated: 0,
    milestone_bonus_vault: 0,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'trade-1',
    account_id: 'acc-1',
    entry_date: '2026-01-01',
    exit_date: '2026-01-10',
    pnl: 100,
    status: 'Closed',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeCycleStart
// ---------------------------------------------------------------------------

describe('computeCycleStart', () => {
  it('returns current month start when today is on the withdrawal day', () => {
    // today = Jan 15 → cycle starts Jan 15
    const today = utcDate(2026, 1, 15);
    const result = computeCycleStart(15, today);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0); // January = 0
    expect(result.getUTCDate()).toBe(15);
  });

  it('returns current month start when today is after the withdrawal day', () => {
    // today = Jan 20, withdrawal_day = 15 → cycle starts Jan 15
    const today = utcDate(2026, 1, 20);
    const result = computeCycleStart(15, today);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0);
    expect(result.getUTCDate()).toBe(15);
  });

  it('returns previous month start when today is before the withdrawal day', () => {
    // today = Jan 10, withdrawal_day = 15 → cycle starts Dec 15 of prev year
    const today = utcDate(2026, 1, 10);
    const result = computeCycleStart(15, today);
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December = 11
    expect(result.getUTCDate()).toBe(15);
  });

  it('wraps year correctly when today is in January and day < withdrawal_day', () => {
    // today = Jan 5, withdrawal_day = 10 → cycle starts Dec 10 prev year
    const today = utcDate(2026, 1, 5);
    const result = computeCycleStart(10, today);
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11);
    expect(result.getUTCDate()).toBe(10);
  });

  it('caps withdrawal_day at 28 to avoid invalid dates', () => {
    // withdrawal_day = 31 in February would fail; function uses Math.min(wd, 28)
    const today = utcDate(2026, 2, 28);
    const result = computeCycleStart(31, today);
    // Day should be 28 (capped)
    expect(result.getUTCDate()).toBe(28);
  });

  it('handles withdrawal_day = 1 (first of month)', () => {
    // today = Mar 15, withdrawal_day = 1 → cycle starts Mar 1
    const today = utcDate(2026, 3, 15);
    const result = computeCycleStart(1, today);
    expect(result.getUTCMonth()).toBe(2); // March = 2
    expect(result.getUTCDate()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeCycleExpectedEnd
// ---------------------------------------------------------------------------

describe('computeCycleExpectedEnd', () => {
  it('returns the day before the next cycle start', () => {
    const cycleStart = utcDate(2026, 1, 15); // Jan 15
    const end = computeCycleExpectedEnd(15, cycleStart);
    // Next cycle start = Feb 15, so expected end = Feb 14
    expect(end.getUTCMonth()).toBe(1); // February
    expect(end.getUTCDate()).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// getCycleInfo
// ---------------------------------------------------------------------------

describe('getCycleInfo', () => {
  it('returns all three fields with consistent dates', () => {
    const cutoff = utcDate(2026, 1, 20);
    const info = getCycleInfo(15, cutoff);
    expect(info.cycleStart).toBeInstanceOf(Date);
    expect(info.cycleExpectedEnd).toBeInstanceOf(Date);
    expect(info.calcCutoff).toBe(cutoff);
    // cycleStart <= calcCutoff <= cycleExpectedEnd
    expect(info.cycleStart.getTime()).toBeLessThanOrEqual(cutoff.getTime());
    expect(info.cycleExpectedEnd.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
  });
});

// ---------------------------------------------------------------------------
// calculatePeriodPnL
// ---------------------------------------------------------------------------

describe('calculatePeriodPnL', () => {
  it('sums PnL for trades within the cycle window (inclusive)', () => {
    const trades: Trade[] = [
      makeTrade({ pnl: 100, exit_date: '2026-01-15' }), // on start date
      makeTrade({ id: 't2', pnl: 200, exit_date: '2026-01-20' }),
      makeTrade({ id: 't3', pnl: 300, exit_date: '2026-01-25' }), // on cutoff
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-25')
    );
    expect(result).toBeCloseTo(600);
  });

  it('excludes trades before cycle start', () => {
    const trades: Trade[] = [
      makeTrade({ pnl: 500, exit_date: '2026-01-14' }), // before start
      makeTrade({ id: 't2', pnl: 100, exit_date: '2026-01-16' }),
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-31')
    );
    expect(result).toBeCloseTo(100);
  });

  it('excludes trades after calc cutoff', () => {
    const trades: Trade[] = [
      makeTrade({ pnl: 100, exit_date: '2026-01-20' }),
      makeTrade({ id: 't2', pnl: 999, exit_date: '2026-01-31' }), // after cutoff
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-25')
    );
    expect(result).toBeCloseTo(100);
  });

  it('excludes trades from a different account', () => {
    const trades: Trade[] = [
      makeTrade({ account_id: 'acc-other', pnl: 500 }),
      makeTrade({ id: 't2', account_id: 'acc-1', pnl: 100, exit_date: '2026-01-20' }),
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-31')
    );
    expect(result).toBeCloseTo(100);
  });

  it('excludes open trades (status != Closed)', () => {
    const trades: Trade[] = [
      makeTrade({ pnl: 200, status: 'Open', exit_date: '2026-01-20' }),
      makeTrade({ id: 't2', pnl: 100, status: 'Closed', exit_date: '2026-01-20' }),
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-31')
    );
    expect(result).toBeCloseTo(100);
  });

  it('returns 0 when no trades match', () => {
    const result = calculatePeriodPnL('acc-1', [], new Date('2026-01-15'), new Date('2026-01-31'));
    expect(result).toBe(0);
  });

  it('falls back to entry_date when exit_date is missing', () => {
    const trades: Trade[] = [
      { ...makeTrade({ pnl: 150 }), exit_date: undefined, entry_date: '2026-01-18' },
    ];
    const result = calculatePeriodPnL(
      'acc-1',
      trades,
      new Date('2026-01-15'),
      new Date('2026-01-31')
    );
    expect(result).toBeCloseTo(150);
  });
});

// ---------------------------------------------------------------------------
// calculateRetirableFromPeriod
// ---------------------------------------------------------------------------

describe('calculateRetirableFromPeriod', () => {
  it('applies growth split (50%) correctly', () => {
    // periodPnL = 1000, profitTotal = 2000 → payoutable = 1000, retirable = 500
    expect(calculateRetirableFromPeriod(1000, 2000, 'growth')).toBeCloseTo(500);
  });

  it('applies safe split (40%) correctly', () => {
    expect(calculateRetirableFromPeriod(1000, 2000, 'safe')).toBeCloseTo(400);
  });

  it('applies cash split (100%) correctly', () => {
    expect(calculateRetirableFromPeriod(1000, 2000, 'cash')).toBeCloseTo(1000);
  });

  it('caps payoutable at profitTotal when periodPnL > profitTotal', () => {
    // periodPnL = 5000 but total profit is only 1000 → payoutable = 1000
    expect(calculateRetirableFromPeriod(5000, 1000, 'growth')).toBeCloseTo(500);
  });

  it('returns 0 when profitTotal is 0 or negative', () => {
    expect(calculateRetirableFromPeriod(500, 0, 'growth')).toBe(0);
    expect(calculateRetirableFromPeriod(500, -100, 'growth')).toBe(0);
  });

  it('returns 0 when periodPnL is negative', () => {
    expect(calculateRetirableFromPeriod(-200, 1000, 'growth')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculatePayoutBreakdown
// ---------------------------------------------------------------------------

describe('calculatePayoutBreakdown', () => {
  it('computes a clean breakdown with no blocking conditions', () => {
    const account = makeAccount({ current_balance: 11000, account_size: 10000 }); // profit = 1000
    const config = makeConfig({ split_mode: 'growth', tax_buffer_percentage: 30 });
    // periodPnL = 1000, profitTotal = 1000 → retirable = 500, tax = 150, cash = 350
    const result = calculatePayoutBreakdown(account, config, 1000, 5);
    expect(result.blockedReasons).toHaveLength(0);
    expect(result.retirable).toBeCloseTo(500);
    expect(result.taxReserveAmount).toBeCloseTo(150);
    expect(result.bonusVaultAmount).toBe(0);
    expect(result.cashPayoutAmount).toBeCloseTo(350);
  });

  it('blocks when withdrawals_enabled = false', () => {
    const account = makeAccount({ withdrawals_enabled: false });
    const config = makeConfig();
    const result = calculatePayoutBreakdown(account, config, 1000, 5);
    expect(result.blockedReasons).toContain('withdrawals_disabled');
  });

  it('blocks when anti-drawdown is active and drawdown exceeds threshold', () => {
    const account = makeAccount();
    const config = makeConfig({ anti_drawdown_active: true, anti_drawdown_threshold: 10 });
    const result = calculatePayoutBreakdown(account, config, 1000, 15); // drawdown = 15 >= 10
    expect(result.blockedReasons).toContain('anti_dd_active');
  });

  it('blocks when balance is below threshold', () => {
    const account = makeAccount({ current_balance: 9000 }); // below 10000 threshold
    const config = makeConfig({ balance_threshold: 10000 });
    const result = calculatePayoutBreakdown(account, config, 1000, 5);
    expect(result.blockedReasons).toContain('balance_below_threshold');
  });

  it('can accumulate multiple blocking reasons', () => {
    const account = makeAccount({ withdrawals_enabled: false, current_balance: 9000 });
    const config = makeConfig({
      balance_threshold: 10000,
      anti_drawdown_active: true,
      anti_drawdown_threshold: 10,
    });
    const result = calculatePayoutBreakdown(account, config, 1000, 25);
    expect(result.blockedReasons.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// isPayoutCreatable
// ---------------------------------------------------------------------------

describe('isPayoutCreatable', () => {
  it('returns true when no blocked reasons and retirable > 0', () => {
    expect(isPayoutCreatable({ retirable: 500, blockedReasons: [], taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 500 })).toBe(true);
  });

  it('returns false when blocked reasons exist', () => {
    expect(isPayoutCreatable({ retirable: 500, blockedReasons: ['withdrawals_disabled'], taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 0 })).toBe(false);
  });

  it('returns false when retirable is 0 even with no blocks', () => {
    expect(isPayoutCreatable({ retirable: 0, blockedReasons: [], taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldSendThresholdPush
// ---------------------------------------------------------------------------

describe('shouldSendThresholdPush', () => {
  it('returns false when no balance_threshold configured', () => {
    const account = makeAccount({ current_balance: 15000 });
    const config = makeConfig({ balance_threshold: undefined });
    expect(shouldSendThresholdPush(account, config, 500)).toBe(false);
  });

  it('returns true when balance >= threshold and retirable > 0', () => {
    const account = makeAccount({ current_balance: 12000 });
    const config = makeConfig({ balance_threshold: 10000 });
    expect(shouldSendThresholdPush(account, config, 500)).toBe(true);
  });

  it('returns false when balance < threshold', () => {
    const account = makeAccount({ current_balance: 9000 });
    const config = makeConfig({ balance_threshold: 10000 });
    expect(shouldSendThresholdPush(account, config, 500)).toBe(false);
  });

  it('returns false when retirable is 0 even if balance >= threshold', () => {
    const account = makeAccount({ current_balance: 12000 });
    const config = makeConfig({ balance_threshold: 10000 });
    expect(shouldSendThresholdPush(account, config, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNextVersion
// ---------------------------------------------------------------------------

describe('getNextVersion', () => {
  it('returns 1 when max version is 0 (default)', () => {
    expect(getNextVersion(0)).toBe(1);
    expect(getNextVersion()).toBe(1);
  });

  it('increments max version by 1', () => {
    expect(getNextVersion(3)).toBe(4);
    expect(getNextVersion(99)).toBe(100);
  });
});
