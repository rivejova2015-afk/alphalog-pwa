'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface AgentSummary {
  id: string;
  name: string;
  type: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  portfolioValue: number;
  winRate: number;
  roi: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface CompareModalProps {
  agents: AgentSummary[];
  onClose: () => void;
}

const METRICS: Array<{ key: keyof AgentSummary; label: string; format: (v: AgentSummary[keyof AgentSummary]) => string; higherIsBetter?: boolean }> = [
  { key: 'portfolioValue', label: 'Portfolio Value', format: (v) => `$${Number(v).toLocaleString()}`, higherIsBetter: true },
  { key: 'winRate', label: 'Win Rate', format: (v) => `${v}%`, higherIsBetter: true },
  { key: 'roi', label: 'ROI', format: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`, higherIsBetter: true },
  { key: 'sharpeRatio', label: 'Sharpe Ratio', format: (v) => String(v), higherIsBetter: true },
  { key: 'maxDrawdown', label: 'Max Drawdown', format: (v) => `${v}%`, higherIsBetter: false },
];

export function CompareModal({ agents, onClose }: CompareModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-[#0a0e1a] border border-[#1f2937] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
          <h2 className="text-base font-bold text-[#e2e8f0] font-mono">Compare Agents</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#151b28] rounded transition-colors" aria-label="Close">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        {/* Comparison table */}
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2937]">
                <th className="text-left py-2 pr-4 text-xs text-[#475569] font-medium uppercase tracking-wider w-32">Metric</th>
                {agents.map((agent) => (
                  <th key={agent.id} className="text-center py-2 px-4 text-[#e2e8f0] font-bold">
                    <div>{agent.name}</div>
                    <div className="text-xs font-normal text-[#94a3b8] capitalize">{agent.type.replace('_', ' ')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => {
                // Find best value
                const values = agents.map((a) => Number(a[metric.key]));
                const bestValue = metric.higherIsBetter
                  ? Math.max(...values)
                  : Math.max(...values.map((v) => -v)) * -1;

                return (
                  <tr key={metric.key} className="border-b border-[#1f2937]/50">
                    <td className="py-3 pr-4 text-xs text-[#94a3b8]">{metric.label}</td>
                    {agents.map((agent) => {
                      const val = Number(agent[metric.key]);
                      const isBest = val === bestValue;
                      return (
                        <td key={agent.id} className="py-3 px-4 text-center">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isBest ? 'text-[#22d3ee]' : 'text-[#94a3b8]'
                            }`}
                          >
                            {metric.format(agent[metric.key])}
                          </span>
                          {isBest && agents.length > 1 && (
                            <span className="ml-1 text-[10px] text-[#22d3ee]/70">★</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
