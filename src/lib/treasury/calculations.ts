/**
 * Treasury Calculations
 * All formulas extracted from reference/base44_export/src/pages/Treasury.jsx
 * Used by Treasury UI components to compute retirable, drawdown, health score, etc.
 */

// Type definitions
export interface Account {
  id: string;
  name: string;
  account_size: number; // Starting balance
  current_balance: number; // Current balance
  phase_status?: string; // e.g., "fase evaluacion", "funded"
  withdrawals_enabled: boolean;
}

export interface TreasuryConfig {
  id?: string;
  user_id?: string;
  account_id: string;
  withdrawal_day: number; // 1-31
  split_mode: 'growth' | 'safe' | 'cash';
  balance_threshold?: number;
  anti_drawdown_active: boolean;
  anti_drawdown_threshold: number; // default 20
  tax_buffer_percentage: number; // default 30
  tax_buffer_accumulated: number; // default 0
  tax_buffer_target?: number;
  milestone_target?: number; // e.g., 50000
  milestone_bonus_vault: number; // default 0
  // Payout engine fields (from migration 012)
  wallet_id?: string; // UUID reference to treasury_wallets
  last_threshold_push_cycle_start?: string; // DATE (last cycle when push was sent)
}

export interface Trade {
  id: string;
  account_id: string;
  entry_date: string; // ISO date
  exit_date?: string; // ISO date
  created_at?: string;
  pnl: number;
  status: 'Open' | 'Closed';
}

/**
 * Get split percentage by mode
 * growth: 50% retirable, safe: 40% retirable, cash: 100% retirable
 */
export function getSplitPercentage(mode: 'growth' | 'safe' | 'cash'): number {
  const splits = { growth: 50, safe: 40, cash: 100 };
  return splits[mode] || 50;
}

/**
 * Calculate retirable amount from an account
 * Formula: profit = (current_balance - account_size)
 * If profit > 0: retirable = profit * (split%/100)
 * Otherwise: 0
 */
export function calculateRetirable(
  account: Account,
  config?: Partial<TreasuryConfig>
): number {
  if (!account || !account.current_balance || !account.account_size) {
    return 0;
  }

  const profit = account.current_balance - account.account_size;
  if (profit <= 0) return 0;

  const splitMode = config?.split_mode || 'growth';
  const percentage = getSplitPercentage(splitMode);

  return profit * (percentage / 100);
}

/**
 * Calculate maximum drawdown percentage from trades
 * Formula:
 *   1. Start with peak = account_size, runningBalance = account_size
 *   2. Sort trades by exit_date (or entry_date if no exit_date)
 *   3. For each trade: runningBalance += pnl
 *      - If runningBalance > peak: peak = runningBalance
 *      - drawdown = ((peak - runningBalance) / peak) * 100
 *   4. Track maxDrawdown
 *
 * Returns 0 if no trades or account not found
 */
export function calculateDrawdown(
  accountId: string,
  account: Account | undefined,
  trades: Trade[]
): number {
  if (!account || !accountId) return 0;

  const accountTrades = trades.filter((t) => t.account_id === accountId && t.status === 'Closed');
  if (accountTrades.length === 0) return 0;

  let peak = account.account_size;
  let maxDrawdown = 0;
  let runningBalance = account.account_size;

  // Sort by exit_date, then entry_date, then created_at
  accountTrades.sort((a, b) => {
    const dateA = new Date(a.exit_date || a.entry_date || a.created_at || 0).getTime();
    const dateB = new Date(b.exit_date || b.entry_date || b.created_at || 0).getTime();
    return dateA - dateB;
  });

  // Iterate through trades and calculate running drawdown
  for (const trade of accountTrades) {
    runningBalance += trade.pnl;

    if (runningBalance > peak) {
      peak = runningBalance;
    }

    const drawdown = peak > 0 ? ((peak - runningBalance) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return Math.max(0, maxDrawdown);
}

/**
 * Calculate health score (0-100) for withdrawal eligibility
 * Logic:
 *   1. Start with score = 100
 *   2. If phase_status includes 'fase' (evaluation): score -= 50
 *   3. If withdrawals_enabled = false: score = 0
 *   4. If drawdown >= anti_drawdown_threshold: score -= 50
 *   5. If balance_threshold exists && current_balance < threshold: score -= 30
 *   6. Clamp to [0, 100]
 *
 * Result interpretation:
 *   100 = Excelente - Sin restricciones (eligible today)
 *   50-99 = Bueno - Algunas restricciones
 *   0-49 = Crítico - No retirar
 */
export function calculateHealthScore(
  account: Account,
  config: Partial<TreasuryConfig> | undefined,
  currentDrawdown: number
): number {
  let score = 100;

  // Check if in evaluation phase
  if (account.phase_status && account.phase_status.toLowerCase().includes('fase')) {
    score -= 50;
  }

  // Check withdrawals enabled
  if (!account.withdrawals_enabled) {
    score = 0;
  }

  // Check drawdown against threshold
  const threshold = config?.anti_drawdown_threshold ?? 20;
  if (currentDrawdown >= threshold) {
    score -= 50;
  }

  // Check balance threshold
  if (config?.balance_threshold && account.current_balance < config.balance_threshold) {
    score -= 30;
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate days until next withdrawal
 * Logic:
 *   1. Get withdrawal_day from config (default 1)
 *   2. Set nextDate to this month, that day
 *   3. If nextDate has passed: move to next month
 *   4. Return days difference (ceiling)
 */
export function daysUntilNextWithdrawal(withdrawalDay: number = 1): number {
  const today = new Date();
  const nextDate = new Date(today.getFullYear(), today.getMonth(), withdrawalDay);

  if (nextDate < today) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  const diffMs = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Calculate tax buffer reserve amount
 * Formula: reserve = retirable * (tax_buffer_percentage / 100)
 */
export function calculateTaxBufferReserve(
  retirable: number,
  taxBufferPercentage: number = 30
): number {
  return retirable * (taxBufferPercentage / 100);
}

/**
 * Get status badge color/variant based on health score
 * Used for UI display
 */
export function getHealthScoreVariant(score: number): string {
  if (score === 100) return 'default'; // Green
  if (score >= 50) return 'warning'; // Orange/Amber
  return 'destructive'; // Red
}

/**
 * Get status text based on health score
 * Used for UI display
 */
export function getHealthScoreStatus(score: number): string {
  if (score === 100) return 'Excelente - Sin restricciones';
  if (score >= 50) return 'Bueno - Algunas restricciones';
  return 'Crítico - No retirar';
}

/**
 * Check if account is in evaluation phase
 */
export function isEvaluationPhase(account: Account): boolean {
  return !!(account.phase_status && account.phase_status.toLowerCase().includes('fase'));
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate milestone progress (0-100%)
 * Formula: progress = (current_balance / milestone_target) * 100
 * Returns 0 if no milestone target
 */
export function calculateMilestoneProgress(
  account: Account,
  config?: Partial<TreasuryConfig>
): number {
  if (!config?.milestone_target || config.milestone_target <= 0) return 0;

  const progress = (account.current_balance / config.milestone_target) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Calculate remaining amount to reach milestone
 * Formula: remaining = max(0, milestone_target - current_balance)
 * Returns 0 if no milestone or already reached
 */
export function calculateMilestoneRemaining(
  account: Account,
  config?: Partial<TreasuryConfig>
): number {
  if (!config?.milestone_target) return 0;

  const remaining = config.milestone_target - account.current_balance;
  return Math.max(0, remaining);
}

/**
 * Calculate tax buffer progress
 * Formula: accumulated / target (if target exists)
 */
export function calculateTaxBufferProgress(
  config?: Partial<TreasuryConfig>
): number {
  if (!config?.tax_buffer_target || config.tax_buffer_target <= 0) return 0;

  const progress = ((config.tax_buffer_accumulated || 0) / config.tax_buffer_target) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Group items by date
 * Used for Calendario view
 */
export function groupByDate<T extends { occurred_on?: string; payout_date?: string }>(
  items: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const date = item.occurred_on || item.payout_date || '';
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(item);
  }

  return grouped;
}

/**
 * Sum transactions or payouts within a date range
 */
export function sumByDateRange<T extends { occurred_on?: string; payout_date?: string; amount: number }>(
  items: T[],
  startDate: string,
  endDate: string
): number {
  return items
    .filter((item) => {
      const itemDate = item.occurred_on || item.payout_date || '';
      return itemDate >= startDate && itemDate <= endDate;
    })
    .reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Format date for display (YYYY-MM-DD format)
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get day of week name
 */
export function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}
