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
      <section className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Account Groups Progress
        </h3>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500">No accounts created yet</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{group.name}</span>
                  <span className="text-sm text-slate-500">{group.count} accounts</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((group.count / 5) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Total Balance: ${group.totalBalance.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Performance Totals
        </h3>
        {!hasData ? (
          <p className="text-sm text-slate-500">No trading data available yet</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard label="Daily %" value={metrics.daily_total_pct} />
            <KPICard label="Weekly %" value={metrics.weekly_total_pct} />
            <KPICard label="Monthly %" value={metrics.monthly_total_pct} />
            <KPICard label="Quarterly %" value={metrics.quarterly_total_pct} />
            <KPICard label="Yearly %" value={metrics.yearly_total_pct} />
            <KPICard label="All Time %" value={metrics.all_time_total_pct} highlight />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">
          Trading Insights
        </h3>
        {!hasData ? (
          <p className="text-sm text-slate-500">Create trades to see insights</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InsightCard label="Win Rate" value={metrics.winRate} unit="%" color="green" />
            <InsightCard label="Drawdown" value={metrics.drawdown} unit="%" color="red" />
            <InsightCard label="Total Trades" value={metrics.totalTrades} color="blue" />
            <InsightCard label="Winning Trades" value={metrics.winningTrades} color="green" />
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
  const displayValue = value !== null ? `${value.toFixed(2)}%` : '-';

  return (
    <div
      className={
        `rounded-2xl p-4 shadow-sm border ${
          highlight
            ? 'border-blue-200 bg-blue-50/70 text-blue-900'
            : 'border-white/70 bg-white/90 text-slate-900'
        }`
      }
    >
      <p className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{displayValue}</p>
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
    green: 'text-emerald-700 bg-emerald-50/70 border-emerald-100',
    red: 'text-rose-700 bg-rose-50/70 border-rose-100',
    blue: 'text-sky-700 bg-sky-50/70 border-sky-100',
  };

  const displayValue = value !== null ? `${Math.round(value)}${unit}` : '-';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClasses[color]}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{displayValue}</p>
    </div>
  );
}
