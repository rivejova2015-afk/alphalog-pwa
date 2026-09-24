'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TrendingUp, Target, BarChart3, PieChart } from 'lucide-react';
import type { TradeAnalytics, TradePattern, TradeCorrelation } from '@/lib/trading/advanced-analytics';

interface AnalyticsPanelProps {
  accountId?: string;
  refreshInterval?: number;
}

export function AdvancedAnalyticsPanel({
  accountId,
  refreshInterval = 60000,
}: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<TradeAnalytics | null>(null);
  const [patterns, setPatterns] = useState<TradePattern[]>([]);
  const [correlations, setCorrelations] = useState<TradeCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'metrics' | 'patterns' | 'correlations'>('metrics');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [accountId, refreshInterval]);

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      if (accountId) params.append('accountId', accountId);

      const res = await fetch(`/api/tradehub/analytics/advanced?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');

      const data = await res.json();
      setAnalytics(data.metrics);
      setPatterns(data.patterns || []);
      setCorrelations(data.correlations || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No trading data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-xs font-medium text-gray-600">Win Rate</p>
          </div>
          <p className="text-3xl font-bold">{(analytics.win_rate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-2">
            {analytics.winning_trades}W / {analytics.losing_trades}L
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <p className="text-xs font-medium text-gray-600">Profit Factor</p>
          </div>
          <p className="text-3xl font-bold">{analytics.profit_factor.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-2">Gross Profit / Loss</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            <p className="text-xs font-medium text-gray-600">Sharpe Ratio</p>
          </div>
          <p className="text-3xl font-bold">{analytics.sharpe_ratio.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-2">Risk-Adjusted Return</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-5 h-5 text-red-600" />
            <p className="text-xs font-medium text-gray-600">Max Drawdown</p>
          </div>
          <p className="text-3xl font-bold">{(analytics.max_drawdown * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-2">Peak to Trough</p>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Advanced Metrics</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border-l-4 border-blue-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Expectancy</p>
            <p className="text-2xl font-bold">${analytics.expectancy.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Expected profit per trade</p>
          </div>

          <div className="border-l-4 border-green-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Recovery Factor</p>
            <p className="text-2xl font-bold">{analytics.recovery_factor.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Total Profit / Max DD</p>
          </div>

          <div className="border-l-4 border-purple-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Avg Trade Duration</p>
            <p className="text-2xl font-bold">{analytics.avg_trade_duration_hours.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">Hours per trade</p>
          </div>

          <div className="border-l-4 border-yellow-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Best Streak</p>
            <p className="text-2xl font-bold">{analytics.consecutive_wins}W</p>
            <p className="text-xs text-gray-500">Consecutive wins</p>
          </div>

          <div className="border-l-4 border-red-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Worst Streak</p>
            <p className="text-2xl font-bold">{analytics.consecutive_losses}L</p>
            <p className="text-xs text-gray-500">Consecutive losses</p>
          </div>

          <div className="border-l-4 border-gray-600 pl-4 py-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Total Trades</p>
            <p className="text-2xl font-bold">{analytics.total_trades}</p>
            <p className="text-xs text-gray-500">Closed trades analyzed</p>
          </div>
        </div>
      </Card>

      {/* Patterns Tab */}
      {patterns.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Top Trading Patterns</h3>
          <div className="space-y-3">
            {patterns.slice(0, 5).map((pattern, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{pattern.pattern_name}</p>
                  <p className="text-xs text-gray-600">
                    {pattern.frequency} trades · Win rate: {(pattern.win_rate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">
                    {pattern.avg_return_percent.toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-600">R:R {pattern.risk_reward_ratio.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Correlations Tab */}
      {correlations.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Symbol Correlations</h3>
          <div className="space-y-2">
            {correlations.slice(0, 5).map((corr, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 text-sm">
                <span className="font-medium">
                  {corr.symbol1} ↔ {corr.symbol2}
                </span>
                <span className={
                  corr.significance === 'strong'
                    ? 'text-red-600 font-bold'
                    : corr.significance === 'moderate'
                      ? 'text-yellow-600 font-bold'
                      : 'text-green-600'
                }>
                  {corr.correlation_coefficient.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
