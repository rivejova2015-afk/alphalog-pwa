'use client';

import { useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDate, formatUSD } from '@/utils/formatters';

interface Operation {
  id: string;
  market: string;
  outcome_type: 'WIN' | 'LOSS';
  outcome_amount: number;
  entry_time: string;
  exit_time: string;
  confidence_score: number;
  reasoning: string | null;
}

interface OperationsModalProps {
  agentName: string;
  operations: Operation[];
  onClose: () => void;
}

// Placeholder operations for demo
const DEMO_OPERATIONS: Operation[] = [
  { id: '1', market: 'Will BTC exceed $100K by EOY?', outcome_type: 'WIN', outcome_amount: 245.50, entry_time: '2025-04-08T10:23:00Z', exit_time: '2025-04-08T14:45:00Z', confidence_score: 0.78, reasoning: 'Strong momentum indicators and institutional buying patterns' },
  { id: '2', market: 'Will Fed cut rates in June?', outcome_type: 'LOSS', outcome_amount: -120.00, entry_time: '2025-04-07T09:15:00Z', exit_time: '2025-04-07T16:30:00Z', confidence_score: 0.62, reasoning: 'Inflation data suggested continued hold' },
  { id: '3', market: 'Will S&P500 close above 5400?', outcome_type: 'WIN', outcome_amount: 380.00, entry_time: '2025-04-06T08:00:00Z', exit_time: '2025-04-06T20:00:00Z', confidence_score: 0.85, reasoning: 'Technical breakout confirmed with volume' },
  { id: '4', market: 'Will AAPL beat Q1 earnings?', outcome_type: 'WIN', outcome_amount: 190.25, entry_time: '2025-04-05T11:00:00Z', exit_time: '2025-04-05T22:00:00Z', confidence_score: 0.71, reasoning: 'Strong supply chain data and services growth' },
];

export function OperationsModal({ agentName, operations = DEMO_OPERATIONS, onClose }: OperationsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap focus + prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const wins = operations.filter(op => op.outcome_type === 'WIN');
  const totalPnl = operations.reduce((sum, op) =>
    sum + (op.outcome_type === 'WIN' ? op.outcome_amount : -Math.abs(op.outcome_amount)), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Operations for ${agentName}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl bg-[#0a0e1a] border border-[#1f2937] rounded-lg shadow-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
          <div>
            <h2 className="text-base font-bold text-[#e2e8f0] font-mono">{agentName}</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Operations History</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#151b28] rounded transition-colors"
            aria-label="Close modal"
          >
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-0 border-b border-[#1f2937]">
          {[
            { label: 'Total Ops', value: String(operations.length), color: '#e2e8f0' },
            { label: 'Win Rate', value: `${Math.round((wins.length / operations.length) * 100)}%`, color: '#34d399' },
            { label: 'Net P&L', value: formatUSD(totalPnl), color: totalPnl >= 0 ? '#34d399' : '#ef4444' },
          ].map((s, i) => (
            <div key={s.label} className={`p-4 text-center ${i < 2 ? 'border-r border-[#1f2937]' : ''}`}>
              <div className="text-xs text-[#475569] mb-1">{s.label}</div>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Operations list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {operations.map((op) => (
            <div
              key={op.id}
              className={`bg-[#151b28] border rounded-lg p-4 ${
                op.outcome_type === 'WIN' ? 'border-[#34d399]/20' : 'border-[#ef4444]/20'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-4">
                  <p className="text-sm text-[#e2e8f0] font-medium leading-tight">{op.market}</p>
                  <p className="text-xs text-[#475569] mt-1">
                    {formatDate(op.entry_time)} → {formatDate(op.exit_time)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`flex items-center gap-1 justify-end font-mono font-bold text-sm ${
                    op.outcome_type === 'WIN' ? 'text-[#34d399]' : 'text-[#ef4444]'
                  }`}>
                    {op.outcome_type === 'WIN'
                      ? <TrendingUp size={14} />
                      : <TrendingDown size={14} />}
                    {op.outcome_type === 'WIN' ? '+' : '-'}{formatUSD(Math.abs(op.outcome_amount))}
                  </div>
                  <div className="text-xs text-[#475569] mt-0.5">
                    Confidence: {Math.round(op.confidence_score * 100)}%
                  </div>
                </div>
              </div>
              {op.reasoning && (
                <p className="text-xs text-[#94a3b8] italic border-t border-[#1f2937] pt-2 mt-2">
                  {op.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
