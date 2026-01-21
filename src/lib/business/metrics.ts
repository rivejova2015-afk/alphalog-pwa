/**
 * Business Metrics Engine
 * Calculates P&L, KPIs, Health, and Runway metrics for business dashboard
 */

import type { BusinessCost } from './types';
import type { Trade } from '@/lib/treasury/calculations';

// ============================================================================
// HELPER: Get trades and costs for a given month
// ============================================================================

export function getMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months.reverse();
}

export function filterTradesByMonth(trades: Trade[], month: string): Trade[] {
  return trades.filter((t) => t.exit_date?.startsWith(month));
}

export function filterCostsByMonth(costs: BusinessCost[], month: string): BusinessCost[] {
  return costs.filter((c) => c.cost_date?.startsWith(month));
}

// ============================================================================
// P&L METRICS (Monthly)
// ============================================================================

export interface PLMetrics {
  monthStr: string;
  grossIncome: number; // Sum of all positive PnL
  netIncome: number; // Sum of PnL - Sum of costs
  totalCosts: number; // Sum of costs
  costsByCategory: Record<string, number>;
  incomeByAccount: Record<string, number>;
  tradeCount: number;
  margin: number; // (netIncome / grossIncome) * 100, or 0 if grossIncome is 0
}

export function calculatePLMetrics(trades: Trade[], costs: BusinessCost[], month: string): PLMetrics {
  const monthTrades = filterTradesByMonth(trades, month);
  const monthCosts = filterCostsByMonth(costs, month);

  const grossIncome = monthTrades.reduce((sum, t) => sum + Math.max(0, t.pnl || 0), 0);
  const totalNetPnl = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalCosts = monthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const netIncome = totalNetPnl - totalCosts;

  // Costs by category
  const costsByCategory: Record<string, number> = {};
  monthCosts.forEach((c) => {
    costsByCategory[c.category] = (costsByCategory[c.category] || 0) + c.amount;
  });

  // Income by account
  const incomeByAccount: Record<string, number> = {};
  monthTrades.forEach((t) => {
    incomeByAccount[t.account_id] = (incomeByAccount[t.account_id] || 0) + t.pnl;
  });

  const margin = grossIncome !== 0 ? (netIncome / grossIncome) * 100 : 0;

  return {
    monthStr: month,
    grossIncome,
    netIncome,
    totalCosts,
    costsByCategory,
    incomeByAccount,
    tradeCount: monthTrades.length,
    margin,
  };
}

// ============================================================================
// KPI METRICS (Monthly)
// ============================================================================

export interface KPIMetrics {
  monthStr: string;
  costPerTrade: number;
  uniqueTradeDays: number;
  daysInMonth: number;
  consistency: number; // (uniqueTradeDays / daysInMonth) * 100
  profitPerHour: number; // netIncome / (uniqueTradeDays * 12)
  accountMetrics: Record<
    string,
    {
      accountId: string;
      tradeCount: number;
      netProfit: number;
      costPerTrade: number;
      profitPerHour: number;
    }
  >;
}

export function calculateKPIMetrics(
  trades: Trade[],
  costs: BusinessCost[],
  month: string,
  costAllocationFn?: (accountId: string, tradeCount: number, totalTrades: number, totalCosts: number) => number
): KPIMetrics {
  const pl = calculatePLMetrics(trades, costs, month);
  const monthTrades = filterTradesByMonth(trades, month);

  // Unique trading days
  const uniqueDays = new Set(monthTrades.map((t) => t.exit_date));
  const uniqueTradeDays = uniqueDays.size;

  // Days in month
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

  // Consistency
  const consistency = uniqueTradeDays > 0 ? (uniqueTradeDays / daysInMonth) * 100 : 0;

  // Profit per hour (12h trading day)
  const profitPerHour = uniqueTradeDays > 0 ? pl.netIncome / (uniqueTradeDays * 12) : 0;

  // Default cost allocation: proportional by trade count
  const defaultCostAllocationFn = (
    _accountId: string,
    tradeCount: number,
    totalTrades: number,
    totalCosts: number
  ) => {
    return totalTrades > 0 ? (tradeCount / totalTrades) * totalCosts : 0;
  };

  const allocationFn = costAllocationFn || defaultCostAllocationFn;

  // Per-account metrics
  const accountMetrics: Record<
    string,
    {
      accountId: string;
      tradeCount: number;
      netProfit: number;
      costPerTrade: number;
      profitPerHour: number;
    }
  > = {};

  const accountTrades = new Map<string, Trade[]>();
  monthTrades.forEach((t) => {
    const trades = accountTrades.get(t.account_id) || [];
    trades.push(t);
    accountTrades.set(t.account_id, trades);
  });

  accountTrades.forEach((accountTradeList, accountId) => {
    const accountNetProfit = accountTradeList.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const accountTradeCount = accountTradeList.length;
    const accountCostAllocation = allocationFn(accountId, accountTradeCount, monthTrades.length, pl.totalCosts);
    const accountNetIncome = accountNetProfit - accountCostAllocation;
    const accountProfitPerHour = uniqueTradeDays > 0 ? accountNetIncome / (uniqueTradeDays * 12) : 0;

    accountMetrics[accountId] = {
      accountId,
      tradeCount: accountTradeCount,
      netProfit: accountNetIncome,
      costPerTrade: accountTradeCount > 0 ? accountCostAllocation / accountTradeCount : 0,
      profitPerHour: accountProfitPerHour,
    };
  });

  return {
    monthStr: month,
    costPerTrade: monthTrades.length > 0 ? pl.totalCosts / monthTrades.length : 0,
    uniqueTradeDays,
    daysInMonth,
    consistency,
    profitPerHour,
    accountMetrics,
  };
}

// ============================================================================
// HEALTH ALERTS
// ============================================================================

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
}

export function calculateHealthAlerts(
  plMetricsLast3: PLMetrics[],
  runwayMonths: number,
  runwayThreshold: number = 3
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // Check for negative months
  plMetricsLast3.forEach((pl) => {
    if (pl.netIncome < 0) {
      alerts.push({
        id: `negative-month-${pl.monthStr}`,
        severity: 'warning',
        title: `Negative Month: ${pl.monthStr}`,
        message: `Net income was $${pl.netIncome.toFixed(2)}. Review trading and costs.`,
      });
    }
  });

  // Check runway
  if (runwayMonths < runwayThreshold && runwayMonths > 0) {
    alerts.push({
      id: 'low-runway',
      severity: 'critical',
      title: 'Low Runway',
      message: `Estimated runway: ${runwayMonths.toFixed(1)} months. Build cash reserves or reduce burn rate.`,
    });
  }

  if (runwayMonths <= 0) {
    alerts.push({
      id: 'critical-runway',
      severity: 'critical',
      title: 'Critical Runway',
      message: 'Runway has expired or burn rate exceeds income. Immediate action required.',
    });
  }

  return alerts;
}

// ============================================================================
// RUNWAY METRICS
// ============================================================================

export interface RunwayMetrics {
  avgMonthlyProfit: number; // Avg of last 3 months
  avgMonthlyBurn: number; // Avg of last 3 months (absolute value of costs)
  runwayRatio: number; // avgProfit / avgBurn
  estimatedCashReserve: number;
  runwayMonths: number; // cashReserve / avgBurn
}

export function calculateRunwayMetrics(
  plMetricsLast3: PLMetrics[],
  estimatedCashReserve: number = 0
): RunwayMetrics {
  const avgMonthlyProfit = plMetricsLast3.length > 0 
    ? plMetricsLast3.reduce((sum, pl) => sum + pl.netIncome, 0) / plMetricsLast3.length 
    : 0;

  const avgMonthlyBurn = plMetricsLast3.length > 0 
    ? plMetricsLast3.reduce((sum, pl) => sum + pl.totalCosts, 0) / plMetricsLast3.length 
    : 0;

  const runwayRatio = avgMonthlyBurn > 0 ? avgMonthlyProfit / avgMonthlyBurn : 0;

  const runwayMonths = avgMonthlyBurn > 0 
    ? Math.max(0, estimatedCashReserve / Math.abs(avgMonthlyBurn)) 
    : Infinity;

  return {
    avgMonthlyProfit,
    avgMonthlyBurn,
    runwayRatio,
    estimatedCashReserve,
    runwayMonths: isFinite(runwayMonths) ? runwayMonths : 0,
  };
}

// ============================================================================
// TREND METRICS (Last 6 months)
// ============================================================================

export interface TrendData {
  month: string;
  income: number;
  costs: number;
  profit: number;
}

export function calculateTrendMetrics(trades: Trade[], costs: BusinessCost[]): TrendData[] {
  const months = getLastNMonths(6);
  return months.map((month) => {
    const pl = calculatePLMetrics(trades, costs, month);
    return {
      month,
      income: pl.grossIncome,
      costs: pl.totalCosts,
      profit: pl.netIncome,
    };
  });
}
