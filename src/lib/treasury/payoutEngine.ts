/**
 * Treasury Payout Engine
 * Handles cycle computation, PnL calculations, and payout breakdowns
 * Reference: base44_export/src/pages/Treasury.jsx + Sprint 7.3/7.4 calculations
 */

import { Account, TreasuryConfig, Trade, getSplitPercentage } from './calculations';

/**
 * Compute cycle start date based on withdrawal_day and today's date (UTC)
 * Logic:
 *   - If today.date >= withdrawal_day: cycle_start = YYYY-MM-{withdrawal_day}
 *   - If today.date < withdrawal_day: cycle_start = YYYY-{prev_month}-{withdrawal_day}
 * Example: withdrawal_day=15, today=2026-01-20 → cycle_start=2026-01-15
 * Example: withdrawal_day=15, today=2026-01-10 → cycle_start=2025-12-15
 */
export function computeCycleStart(
  withdrawalDay: number,
  todayUTC: Date = new Date()
): Date {
  const year = todayUTC.getUTCFullYear();
  const month = todayUTC.getUTCMonth(); // 0-11
  const day = todayUTC.getUTCDate(); // 1-31

  let cycleYear = year;
  let cycleMonth = month;

  if (day < withdrawalDay) {
    // Go back one month
    cycleMonth -= 1;
    if (cycleMonth < 0) {
      cycleMonth = 11;
      cycleYear -= 1;
    }
  }

  // Return date as YYYY-MM-DD (always at midnight UTC)
  return new Date(Date.UTC(cycleYear, cycleMonth, Math.min(withdrawalDay, 28)));
}

/**
 * Compute cycle expected end date (day before next cycle start)
 * Logic:
 *   - next_cycle_start = computeCycleStart(wd, cycleStart + 1 month)
 *   - cycle_expected_end = next_cycle_start - 1 day
 */
export function computeCycleExpectedEnd(
  withdrawalDay: number,
  cycleStart: Date
): Date {
  const nextMonth = new Date(cycleStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const nextCycleStart = computeCycleStart(withdrawalDay, nextMonth);
  const expectedEnd = new Date(nextCycleStart);
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);

  return expectedEnd;
}

/**
 * Interface for cycle computation result
 */
export interface CycleInfo {
  cycleStart: Date;
  cycleExpectedEnd: Date;
  calcCutoff: Date;
}

/**
 * Get complete cycle info for a given withdrawal day and cutoff date
 */
export function getCycleInfo(
  withdrawalDay: number,
  calcCutoff: Date = new Date()
): CycleInfo {
  const cycleStart = computeCycleStart(withdrawalDay, calcCutoff);
  const cycleExpectedEnd = computeCycleExpectedEnd(withdrawalDay, cycleStart);

  return {
    cycleStart,
    cycleExpectedEnd,
    calcCutoff,
  };
}

/**
 * Calculate period PnL from trades closed within cycle
 * Logic:
 *   1. Filter trades where status == 'Closed'
 *   2. Trade date = exit_date if exists, else entry_date if exists, else created_at
 *   3. Include if trade_date is within [cycleStart, calcCutoff] (inclusive, both as dates not timestamps)
 *   4. Sum all pnl values
 * Returns: sum of PnL (can be negative)
 */
export function calculatePeriodPnL(
  accountId: string,
  trades: Trade[],
  cycleStart: Date,
  calcCutoff: Date
): number {
  const accountTrades = trades.filter((t) => t.account_id === accountId && t.status === 'Closed');

  if (accountTrades.length === 0) {
    return 0;
  }

  // Convert dates to YYYY-MM-DD for comparison (ignore time)
  const cycleStartStr = cycleStart.toISOString().split('T')[0];
  const calcCutoffStr = calcCutoff.toISOString().split('T')[0];

  let totalPnL = 0;

  for (const trade of accountTrades) {
    const tradeDate = trade.exit_date || trade.entry_date || trade.created_at || '';
    const tradeDateStr = tradeDate.split('T')[0]; // Extract YYYY-MM-DD

    // Check if trade is within cycle (inclusive)
    if (tradeDateStr >= cycleStartStr && tradeDateStr <= calcCutoffStr) {
      totalPnL += trade.pnl;
    }
  }

  return totalPnL;
}

/**
 * Calculate retirable profit for payout calculation
 * Logic:
 *   1. profitTotal = current_balance - account_size
 *   2. payoutableProfit = max(0, min(periodPnL, profitTotal))
 *      - Can't be more than actual profits from period
 *      - Can't be more than total account profit
 *   3. retirable = payoutableProfit * (split% / 100)
 * Returns: amount available for split allocation
 */
export function calculateRetirableFromPeriod(
  periodPnL: number,
  profitTotal: number,
  splitMode: 'growth' | 'safe' | 'cash' = 'growth'
): number {
  // Payoutable profit is the minimum of period PnL and total profit
  const payoutableProfit = Math.max(0, Math.min(periodPnL, profitTotal));

  // Apply split percentage
  const splitPercentage = getSplitPercentage(splitMode);
  const retirable = payoutableProfit * (splitPercentage / 100);

  return Math.max(0, retirable);
}

/**
 * Interface for payout breakdown
 */
export interface PayoutBreakdown {
  retirable: number;
  taxReserveAmount: number;
  bonusVaultAmount: number;
  cashPayoutAmount: number;
  blockedReasons: string[];
}

/**
 * Calculate complete payout breakdown for an account
 * Handles all allocations and blocking conditions
 * 
 * Blocking conditions:
 *   - anti_drawdown_active && drawdown >= anti_drawdown_threshold → "anti_dd_active"
 *   - balance_threshold && current_balance < balance_threshold → "balance_below_threshold"
 *   - withdrawals_enabled == false → "withdrawals_disabled"
 * 
 * Allocation:
 *   1. retirable = periodPnL based on split mode
 *   2. tax_reserve = retirable * (tax_buffer_percentage / 100)
 *   3. bonus_vault = 0 (set to 0, no explicit rule, editable in Milestone panel)
 *   4. cash_payout = max(0, retirable - tax_reserve - bonus_vault)
 */
export function calculatePayoutBreakdown(
  account: Account,
  config: TreasuryConfig,
  periodPnL: number,
  currentDrawdown: number
): PayoutBreakdown {
  const blockedReasons: string[] = [];

  // Check blocking conditions
  if (!account.withdrawals_enabled) {
    blockedReasons.push('withdrawals_disabled');
  }

  if (config.anti_drawdown_active && currentDrawdown >= config.anti_drawdown_threshold) {
    blockedReasons.push('anti_dd_active');
  }

  if (config.balance_threshold && account.current_balance < config.balance_threshold) {
    blockedReasons.push('balance_below_threshold');
  }

  // Calculate profit total
  const profitTotal = account.current_balance - account.account_size;

  // Calculate retirable
  const retirable = calculateRetirableFromPeriod(periodPnL, profitTotal, config.split_mode);

  // Calculate tax reserve
  const taxReserveAmount = retirable * (config.tax_buffer_percentage / 100);

  // Bonus vault: default 0, can be edited in Milestone panel
  const bonusVaultAmount = 0;

  // Cash payout: remainder after allocations
  const cashPayoutAmount = Math.max(0, retirable - taxReserveAmount - bonusVaultAmount);

  return {
    retirable,
    taxReserveAmount,
    bonusVaultAmount,
    cashPayoutAmount,
    blockedReasons,
  };
}

/**
 * Determine if an account can have a payout created
 * (i.e., it's not blocked by any conditions)
 */
export function isPayoutCreatable(breakdown: PayoutBreakdown): boolean {
  return breakdown.blockedReasons.length === 0 && breakdown.retirable > 0;
}

/**
 * Check if threshold push condition is met
 * Condition: (current_balance >= balance_threshold) AND (retirable > 0)
 * If yes, should send push notification
 */
export function shouldSendThresholdPush(
  account: Account,
  config: TreasuryConfig,
  retirable: number
): boolean {
  if (!config.balance_threshold) {
    return false; // No threshold configured
  }

  return account.current_balance >= config.balance_threshold && retirable > 0;
}

/**
 * Format cycle dates for display
 */
export function formatCycleDates(cycleStart: Date, cycleEnd: Date): string {
  const start = cycleStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const end = cycleEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${start} - ${end}`;
}

/**
 * Validate that a version is appropriate for a cycle
 * (for conflict detection in create endpoint)
 */
export function getNextVersion(maxVersionInCycle: number = 0): number {
  return maxVersionInCycle + 1;
}
