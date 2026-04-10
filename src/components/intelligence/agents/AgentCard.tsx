'use client';

import { Pause, Play, Settings } from 'lucide-react';
import { Badge } from '@/components/shared/Badge';

interface AgentCardProps {
  id: string;
  name: string;
  type: 'polymarket' | 'custom_ia';
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  portfolioValue: number;
  winRate: number;
  roi: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastTradeTime: string;
  onViewOps: () => void;
  onPause: () => void;
  onSettings: () => void;
}

export function AgentCard({
  name,
  type,
  status,
  portfolioValue,
  winRate,
  roi,
  sharpeRatio,
  maxDrawdown,
  lastTradeTime,
  onViewOps,
  onPause,
  onSettings,
}: AgentCardProps) {
  const statusVariant =
    status === 'ACTIVE' ? 'success' : status === 'ERROR' ? 'error' : 'warning';

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4 hover:border-[#22d3ee]/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#e2e8f0]">{name}</h3>
          <p className="text-xs text-[#94a3b8] capitalize">{type.replace('_', ' ')}</p>
        </div>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>

      {/* Metrics Grid 2x2 */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div>
          <div className="text-[#475569] mb-1">Portfolio</div>
          <div className="text-[#e2e8f0] font-mono font-bold">
            ${portfolioValue.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[#475569] mb-1">Win Rate</div>
          <div className="text-[#34d399] font-mono font-bold">{winRate}%</div>
        </div>
        <div>
          <div className="text-[#475569] mb-1">ROI</div>
          <div
            className={`font-mono font-bold ${roi > 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}
          >
            {roi > 0 ? '+' : ''}
            {roi}%
          </div>
        </div>
        <div>
          <div className="text-[#475569] mb-1">Sharpe</div>
          <div className="text-[#22d3ee] font-mono font-bold">{sharpeRatio}</div>
        </div>
      </div>

      {/* Max Drawdown Bar */}
      <div className="mb-4">
        <div className="text-xs text-[#475569] mb-1">Max Drawdown</div>
        <div className="h-2 bg-[#0a0e1a] rounded overflow-hidden mb-1">
          <div
            className="h-full bg-[#ef4444]"
            style={{ width: `${Math.min(Math.abs(maxDrawdown), 100)}%` }}
          />
        </div>
        <div className="text-xs text-[#ef4444]">{maxDrawdown}%</div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={onViewOps}
          className="flex-1 px-3 py-2 bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 text-[#22d3ee] text-xs font-bold rounded transition-colors"
        >
          Operations
        </button>
        <button
          onClick={onPause}
          className="px-2 py-2 hover:bg-[#151b28] text-[#94a3b8] rounded transition-colors"
          title={status === 'ACTIVE' ? 'Pause' : 'Resume'}
          aria-label={status === 'ACTIVE' ? 'Pause agent' : 'Resume agent'}
        >
          {status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={onSettings}
          className="px-2 py-2 hover:bg-[#151b28] text-[#94a3b8] rounded transition-colors"
          aria-label="Agent settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Last Trade */}
      <div className="text-xs text-[#475569] pt-3 border-t border-[#1f2937]">
        Last trade: {lastTradeTime}
      </div>
    </div>
  );
}
