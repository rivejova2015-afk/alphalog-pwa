/**
 * Dashboard Queries
 * Safe queries for dashboard performance metrics
 */

import { createClient } from '@/lib/supabase/server';

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
      console.error('[Dashboard] Error fetching accounts:', error);
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
    console.error('[Dashboard] Accounts grouping failed:', error);
    return [];
  }
}

/**
 * Get trades and calculate performance metrics
 */
export async function getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
  try {
    const supabase = await createClient();
    
    // Fetch trades
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('id, entry_date, exit_date, pnl, direction, setup_id, status')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('exit_date', 'is', null);

    if (tradesError) {
      console.error('[Dashboard] Error fetching trades:', tradesError);
      return getEmptyMetrics();
    }

    const tradesList = trades || [];
    const totalTrades = tradesList.length;
    
    if (totalTrades === 0) {
      return getEmptyMetrics();
    }

    // Calculate metrics
    const winningTrades = tradesList.filter((t: any) => t.pnl && t.pnl > 0).length;
    const losingTrades = tradesList.filter((t: any) => t.pnl && t.pnl <= 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Get top setup
    const setupCounts = new Map<string, number>();
    tradesList.forEach((t: any) => {
      if (t.setup_id) {
        setupCounts.set(t.setup_id, (setupCounts.get(t.setup_id) || 0) + 1);
      }
    });
    
    let topSetup: string | null = null;
    let maxCount = 0;
    setupCounts.forEach((count, setup) => {
      if (count > maxCount) {
        maxCount = count;
        topSetup = setup;
      }
    });

    // Calculate simple drawdown (peak to trough)
    const pnlValues = tradesList
      .map((t: any) => t.pnl || 0)
      .sort((a, b) => a - b);
    
    const maxPnl = Math.max(...pnlValues, 0);
    const minPnl = Math.min(...pnlValues, 0);
    const drawdown = maxPnl > 0 ? Math.abs(minPnl / maxPnl) * 100 : 0;

    // Calculate returns by period (simplified)
    const totalPnl = tradesList.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    
    // For now, show total as all_time; in production, calculate by date range
    return {
      daily_total_pct: null, // Would need daily aggregate
      weekly_total_pct: null, // Would need weekly aggregate
      monthly_total_pct: null, // Would need monthly aggregate
      quarterly_total_pct: null, // Would need quarterly aggregate
      yearly_total_pct: null, // Would need yearly aggregate
      all_time_total_pct: totalPnl > 0 ? ((totalPnl / 1000) * 100) : 0, // Simplified: assume 1000 base
      winRate: Math.round(winRate * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      topSetup,
      totalTrades,
      winningTrades,
      losingTrades,
    };
  } catch (error) {
    console.error('[Dashboard] Performance metrics calculation failed:', error);
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
