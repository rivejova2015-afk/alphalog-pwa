/**
 * Dashboard Queries
 * Safe queries for dashboard performance metrics
 */

import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/log';

export interface AccountGroup {
  name: string;
  count: number;
  totalBalance: number;
}

export interface PerformanceMetrics {
  daily_total_pct: number | null;
  weekly_total_pct: number | null;
  monthly_total_pct: number | null;
  quarterly_total_pct: number | null;
  yearly_total_pct: number | null;
  all_time_total_pct: number | null;
  winRate: number | null;
  drawdown: number | null;
  topSetup: string | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** ISO string for the start of the current UTC day (00:00:00.000Z) */
function startOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

/** ISO string for the most recent Monday 00:00:00 UTC */
function startOfUtcWeek(now: Date): string {
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday)
  ).toISOString();
}

/** ISO string for the 1st of the current UTC month */
function startOfUtcMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** ISO string for the 1st of the current UTC quarter (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct) */
function startOfUtcQuarter(now: Date): string {
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1)).toISOString();
}

/** ISO string for Jan 1 of the current UTC year */
function startOfUtcYear(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
}

interface ClosedTrade {
  pnl: number | null;
  exit_date: string | null;
}

/** Sum pnl for trades whose exit_date >= periodStart */
function pnlForPeriod(trades: ClosedTrade[], periodStart: string): number {
  return trades
    .filter((t) => t.exit_date != null && t.exit_date >= periodStart)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
}

/** Convert pnl amount to percentage of base_capital; returns null if base is 0 */
function toPct(pnlAmount: number, baseCapital: number): number | null {
  if (baseCapital <= 0) return null;
  return Math.round((pnlAmount / baseCapital) * 10000) / 100; // 2 dp
}

// ---------------------------------------------------------------------------
// getAccountGroups
// ---------------------------------------------------------------------------

/**
 * Get accounts grouped by category with balance info
 */
export async function getAccountGroups(userId: string): Promise<AccountGroup[]> {
  try {
    const supabase = await createClient();

    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, name, current_balance, category_id, account_categories(name)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      logError('Dashboard', { component: 'dashboard.queries.accounts', message: 'Error fetching accounts', error: error instanceof Error ? error.message : String(error) });
      return [];
    }

    // Group by category
    const grouped = new Map<string, AccountGroup>();

    (accounts || []).forEach((account: any) => {
      const categoryName = account.account_categories?.name || 'All Accounts';
      if (!grouped.has(categoryName)) {
        grouped.set(categoryName, { name: categoryName, count: 0, totalBalance: 0 });
      }

      const group = grouped.get(categoryName)!;
      group.count++;
      group.totalBalance += account.current_balance || 0;
    });

    return Array.from(grouped.values());
  } catch (error) {
    logError('Dashboard', { component: 'dashboard.queries.grouping', message: 'Accounts grouping failed', error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// getPerformanceMetrics
// ---------------------------------------------------------------------------

/**
 * Get trades and calculate performance metrics
 */
export async function getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
  try {
    const supabase = await createClient();

    // Run account, trade, and setup fetches in parallel
    const [accountsResult, tradesResult, setupsResult] = await Promise.all([
      supabase
        .from('accounts')
        .select('account_size')
        .eq('user_id', userId)
        .is('deleted_at', null),

      supabase
        .from('trades')
        .select('id, entry_date, exit_date, pnl, direction, setup_id, status')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .not('exit_date', 'is', null),

      supabase
        .from('setups')
        .select('id, name')
        .eq('user_id', userId)
        .is('deleted_at', null),
    ]);

    if (tradesResult.error) {
      logError('Dashboard', { component: 'dashboard.queries.trades', message: 'Error fetching trades', error: tradesResult.error instanceof Error ? tradesResult.error.message : String(tradesResult.error) });
      return getEmptyMetrics();
    }
    if (accountsResult.error) {
      logError('Dashboard', { component: 'dashboard.queries.baseCapital', message: 'Error fetching accounts for base capital', error: accountsResult.error instanceof Error ? accountsResult.error.message : String(accountsResult.error) });
    }

    // ---------------------------------------------------------------------------
    // Base capital: sum of account_size across all non-deleted accounts
    // ---------------------------------------------------------------------------
    const baseCapital = (accountsResult.data || []).reduce(
      (sum: number, a: any) => sum + (Number(a.account_size) || 0),
      0
    );

    // ---------------------------------------------------------------------------
    // Setup name lookup map
    // ---------------------------------------------------------------------------
    const setupNameById = new Map<string, string>();
    if (!setupsResult.error && setupsResult.data) {
      (setupsResult.data as Array<{ id: string; name: string | null }>).forEach((s) => {
        if (s.name) setupNameById.set(s.id, s.name);
      });
    }

    // ---------------------------------------------------------------------------
    // Core trade stats
    // ---------------------------------------------------------------------------
    // tradesList rows have pnl as number | null (numeric column from Supabase)
    const tradesList = (tradesResult.data || []) as Array<{
      id: string;
      entry_date: string | null;
      exit_date: string | null;
      pnl: number | null;
      direction: string | null;
      setup_id: string | null;
      status: string | null;
    }>;

    const totalTrades = tradesList.length;

    if (totalTrades === 0) {
      return getEmptyMetrics();
    }

    const winningTrades = tradesList.filter((t) => (t.pnl ?? 0) > 0).length;
    const losingTrades = tradesList.filter((t) => (t.pnl ?? 0) < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // ---------------------------------------------------------------------------
    // Top setup — resolved to name
    // ---------------------------------------------------------------------------
    const setupCounts = new Map<string, number>();
    tradesList.forEach((t) => {
      if (t.setup_id) {
        setupCounts.set(t.setup_id, (setupCounts.get(t.setup_id) || 0) + 1);
      }
    });

    let topSetupId: string | null = null;
    let maxCount = 0;
    setupCounts.forEach((count, setupId) => {
      if (count > maxCount) {
        maxCount = count;
        topSetupId = setupId;
      }
    });

    const topSetup = topSetupId ? (setupNameById.get(topSetupId) ?? topSetupId) : null;

    // ---------------------------------------------------------------------------
    // Drawdown (peak-to-trough on individual trade P&L values)
    // ---------------------------------------------------------------------------
    const pnlValues = tradesList
      .map((t) => t.pnl ?? 0)
      .sort((a, b) => a - b);
    const maxPnl = Math.max(...pnlValues, 0);
    const minPnl = Math.min(...pnlValues, 0);
    const drawdown = maxPnl > 0 ? Math.abs(minPnl / maxPnl) * 100 : 0;

    // ---------------------------------------------------------------------------
    // Period P&L percentages
    // ---------------------------------------------------------------------------
    const now = new Date();
    const closedTrades: ClosedTrade[] = tradesList.map((t) => ({
      pnl: t.pnl,
      exit_date: t.exit_date,
    }));

    const dailyPnl = pnlForPeriod(closedTrades, startOfUtcDay(now));
    const weeklyPnl = pnlForPeriod(closedTrades, startOfUtcWeek(now));
    const monthlyPnl = pnlForPeriod(closedTrades, startOfUtcMonth(now));
    const quarterlyPnl = pnlForPeriod(closedTrades, startOfUtcQuarter(now));
    const yearlyPnl = pnlForPeriod(closedTrades, startOfUtcYear(now));
    const allTimePnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    return {
      daily_total_pct: toPct(dailyPnl, baseCapital),
      weekly_total_pct: toPct(weeklyPnl, baseCapital),
      monthly_total_pct: toPct(monthlyPnl, baseCapital),
      quarterly_total_pct: toPct(quarterlyPnl, baseCapital),
      yearly_total_pct: toPct(yearlyPnl, baseCapital),
      all_time_total_pct: toPct(allTimePnl, baseCapital),
      winRate: Math.round(winRate * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      topSetup,
      totalTrades,
      winningTrades,
      losingTrades,
    };
  } catch (error) {
    logError('Dashboard', { component: 'dashboard.queries.metrics', message: 'Performance metrics calculation failed', error: error instanceof Error ? error.message : String(error) });
    return getEmptyMetrics();
  }
}

function getEmptyMetrics(): PerformanceMetrics {
  return {
    daily_total_pct: null,
    weekly_total_pct: null,
    monthly_total_pct: null,
    quarterly_total_pct: null,
    yearly_total_pct: null,
    all_time_total_pct: null,
    winRate: null,
    drawdown: null,
    topSetup: null,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
  };
}
