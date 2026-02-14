'use client';

import React from 'react';
import type { Account, TreasuryConfig, Trade } from '@/lib/treasury/calculations';
import { calculateHealthScore, calculateDrawdown } from '@/lib/treasury/calculations';

interface HeatmapPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  trades: Trade[];
}

export default function HeatmapPanel({ accounts, configs, trades }: HeatmapPanelProps) {
  // Map configs by account ID for quick lookup
  const configMap: Record<string, TreasuryConfig> = {};
  configs.forEach(cfg => {
    if (cfg.account_id) {
      configMap[cfg.account_id] = cfg;
    }
  });

  // Calculate health scores for all accounts
  const healthScores = accounts.map(account => {
    const config = configMap[account.id];
    
    // Get trades for this account
    const accountTrades = trades.filter(t => t.account_id === account.id);
    
    // Calculate current drawdown
    const drawdown = calculateDrawdown(account.id, account, accountTrades);
    
    // Calculate health score
    const score = calculateHealthScore(account, config, drawdown);

    return {
      id: account.id,
      name: account.name,
      score,
      drawdown,
      config,
      account,
      trades: accountTrades,
    };
  });

  // Calculate aggregate health score (average of all)
  const aggregateScore = healthScores.length > 0
    ? Math.round(healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length)
    : 0;

  // Categorize scores
  const healthyCount = healthScores.filter(h => h.score >= 75).length;
  const warningCount = healthScores.filter(h => h.score >= 50 && h.score < 75).length;
  const criticalCount = healthScores.filter(h => h.score < 50).length;

  // Helper to get color for score
  const getScoreColor = (score: number): string => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 75) return 'bg-green-900/20 border-green-500/30';
    if (score >= 50) return 'bg-yellow-900/20 border-yellow-500/30';
    return 'bg-red-900/20 border-red-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Aggregate Score */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-2">🔥 Aggregate Health</div>
          <div className={`text-3xl font-bold ${getScoreColor(aggregateScore)}`}>
            {aggregateScore}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {aggregateScore >= 75 && '🟢 Healthy'}
            {aggregateScore >= 50 && aggregateScore < 75 && '🟡 Warning'}
            {aggregateScore < 50 && '🔴 Critical'}
          </div>
        </div>

        {/* Healthy Count */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-2">🟢 Healthy</div>
          <div className="text-3xl font-bold text-green-400">{healthyCount}</div>
          <div className="text-slate-500 text-xs mt-1">Score ≥ 75</div>
        </div>

        {/* Warning Count */}
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-2">🟡 Warning</div>
          <div className="text-3xl font-bold text-yellow-400">{warningCount}</div>
          <div className="text-slate-500 text-xs mt-1">Score 50-75</div>
        </div>

        {/* Critical Count */}
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-2">🔴 Critical</div>
          <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
          <div className="text-slate-500 text-xs mt-1">Score &lt; 50</div>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-full overflow-x-auto">
        <table className="table-mobile-cards w-full">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="px-4 py-3 text-left text-slate-300 text-sm font-medium">Account</th>
              <th className="px-4 py-3 text-center text-slate-300 text-sm font-medium">Health Score</th>
              <th className="px-4 py-3 text-center text-slate-300 text-sm font-medium">Drawdown</th>
              <th className="px-4 py-3 text-left text-slate-300 text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-slate-300 text-sm font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {healthScores.length > 0 ? (
              healthScores.map((hs) => (
                <tr
                  key={hs.id}
                  className={`border-b border-slate-700 hover:bg-slate-800/50 transition-colors ${getScoreBgColor(hs.score)}`}
                >
                  {/* Account Name */}
                  <td data-label="Account" className="px-4 py-3">
                    <div className="font-medium text-white">{hs.name}</div>
                    <div className="text-slate-500 text-xs">{hs.id.slice(0, 8)}...</div>
                  </td>

                  {/* Health Score */}
                  <td data-label="Health Score" className="px-4 py-3 text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(hs.score)}`}>
                      {hs.score}
                    </div>
                  </td>

                  {/* Drawdown */}
                  <td data-label="Drawdown" className="px-4 py-3 text-center">
                    <div className="text-slate-300 font-medium">
                      {hs.drawdown.toFixed(2)}%
                    </div>
                    <div className={`text-xs mt-1 ${hs.drawdown >= (hs.config?.anti_drawdown_threshold ?? 20) ? 'text-red-400' : 'text-green-400'}`}>
                      {hs.drawdown >= (hs.config?.anti_drawdown_threshold ?? 20) ? '⚠️ High' : '✓ Safe'}
                    </div>
                  </td>

                  {/* Status */}
                  <td data-label="Status" className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {hs.score >= 75 && <span className="text-green-400 text-sm">✓ Healthy</span>}
                      {hs.score >= 50 && hs.score < 75 && <span className="text-yellow-400 text-sm">⚠️ Warning</span>}
                      {hs.score < 50 && <span className="text-red-400 text-sm">✗ Critical</span>}
                    </div>
                  </td>

                  {/* Flags */}
                  <td data-label="Flags" className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {!hs.account.withdrawals_enabled && (
                        <span className="px-2 py-1 bg-red-900/40 border border-red-500/50 rounded text-red-400 text-xs font-medium">
                          🔒 Withdrawals Disabled
                        </span>
                      )}
                      {hs.config?.anti_drawdown_active && (
                        <span className="px-2 py-1 bg-blue-900/40 border border-blue-500/50 rounded text-blue-400 text-xs font-medium">
                          🛡️ Anti-DD On
                        </span>
                      )}
                      {hs.config?.balance_threshold && hs.account.current_balance < hs.config.balance_threshold && (
                        <span className="px-2 py-1 bg-orange-900/40 border border-orange-500/50 rounded text-orange-400 text-xs font-medium">
                          ⏳ Umbral Active
                        </span>
                      )}
                      {hs.account.phase_status && hs.account.phase_status.toLowerCase().includes('fase') && (
                        <span className="px-2 py-1 bg-purple-900/40 border border-purple-500/50 rounded text-purple-400 text-xs font-medium">
                          📊 In Phase
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  <div className="text-base mb-2">No accounts available</div>
                  <div className="text-sm">Add accounts to see health scores</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="text-slate-300 font-medium mb-3">Health Score Legend</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-green-400 font-medium">75-100:</span>
            <span className="text-slate-400 ml-2">Healthy ✓ Ready for withdrawals</span>
          </div>
          <div>
            <span className="text-yellow-400 font-medium">50-74:</span>
            <span className="text-slate-400 ml-2">Warning ⚠️ Monitor conditions</span>
          </div>
          <div>
            <span className="text-red-400 font-medium">0-49:</span>
            <span className="text-slate-400 ml-2">Critical 🔴 Withdrawal blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
