/**
 * DashboardPerformancePanel
 * Shows account groups, performance totals, and trading insights
 */

import React from 'react';
import type { AccountGroup, PerformanceMetrics } from '@/lib/dashboard/queries';

interface Props {
  groups: AccountGroup[];
  metrics: PerformanceMetrics;
}

export default function DashboardPerformancePanel({ groups, metrics }: Props) {
  const hasData = metrics.totalTrades > 0;

  return (
    <div className="space-y-8">
      {/* Account Groups Progress */}
      <section className="rounded-lg bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Account Groups Progress
        </h3>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">No accounts created yet</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{group.name}</span>
                  <span className="text-sm text-gray-500">{group.count} accounts</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((group.count / 5) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Total Balance: ${group.totalBalance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Performance Totals */}
      <section className="rounded-lg bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Performance Totals
        </h3>
        {!hasData ? (
          <p className="text-sm text-gray-500">No trading data available yet</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard 
              label="Daily %" 
              value={metrics.daily_total_pct}
            />
            <KPICard 
              label="Weekly %" 
              value={metrics.weekly_total_pct}
            />
            <KPICard 
              label="Monthly %" 
              value={metrics.monthly_total_pct}
            />
            <KPICard 
              label="Quarterly %" 
              value={metrics.quarterly_total_pct}
            />
            <KPICard 
              label="Yearly %" 
              value={metrics.yearly_total_pct}
            />
            <KPICard 
              label="All Time %" 
              value={metrics.all_time_total_pct}
              highlight
            />
          </div>
        )}
      </section>

      {/* Trading Insights */}
      <section className="rounded-lg bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Trading Insights
        </h3>
        {!hasData ? (
          <p className="text-sm text-gray-500">Create trades to see insights</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InsightCard 
              label="Win Rate" 
              value={metrics.winRate}
              unit="%"
              color="green"
            />
            <InsightCard 
              label="Drawdown" 
              value={metrics.drawdown}
              unit="%"
              color="red"
            />
            <InsightCard 
              label="Total Trades" 
              value={metrics.totalTrades}
              color="blue"
            />
            <InsightCard 
              label="Winning Trades" 
              value={metrics.winningTrades}
              color="green"
            />
          </div>
        )}
      </section>
    </div>
  );
}

interface KPICardProps {
  label: string;
  value: number | null;
  highlight?: boolean;
}

function KPICard({ label, value, highlight }: KPICardProps) {
  const displayValue = value !== null ? `${value.toFixed(2)}%` : '—';
  
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${highlight ? 'text-blue-900' : 'text-gray-900'}`}>
        {displayValue}
      </p>
    </div>
  );
}

interface InsightCardProps {
  label: string;
  value: number | null;
  unit?: string;
  color: 'green' | 'red' | 'blue';
}

function InsightCard({ label, value, unit = '', color }: InsightCardProps) {
  const colorClasses = {
    green: 'text-green-900 bg-green-50',
    red: 'text-red-900 bg-red-50',
    blue: 'text-blue-900 bg-blue-50',
  };
  
  const displayValue = value !== null ? `${Math.round(value)}${unit}` : '—';
  
  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-bold">
        {displayValue}
      </p>
    </div>
  );
}
