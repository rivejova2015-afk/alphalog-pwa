'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AlgoCard } from './AlgoCard';
import { TradesTable } from './TradesTable';
import { EquityCurve } from './EquityCurve';
import { ControlPanel } from './ControlPanel.client';
import { QuantModelsPanel } from './QuantModelsPanel';
import { OpenPositionsPanel } from './OpenPositionsPanel.client';
import { Badge } from '@/components/shared/Badge';

type MarketType = 'forex' | 'futures' | 'options';
type Direction  = 'long' | 'short' | 'both';

interface AlgoData {
  id: string;
  name: string;
  marketType: MarketType;
  instrument: string;
  direction?: Direction;
  parameters?: Record<string, unknown>;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  linkedBotAccountId?: string | null;
  pnlToday: number;
  pnlTotal: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
}

interface AlgoAccordionProps {
  algos: AlgoData[];
}

export function AlgoAccordion({ algos }: AlgoAccordionProps) {
  const [expanded, setExpanded] = useState<string | null>(algos[0]?.id ?? null);
  const [statuses, setStatuses] = useState<Record<string, AlgoData['status']>>(
    Object.fromEntries(algos.map((a) => [a.id, a.status]))
  );

  // Sync statuses when algos prop changes (e.g. after router.refresh() adds a new entry)
  useEffect(() => {
    setStatuses((prev) => {
      const updated = { ...prev };
      algos.forEach((a) => { if (!(a.id in updated)) updated[a.id] = a.status; });
      return updated;
    });
  }, [algos]);

  const handleStatusChange = (id: string, newStatus: 'ACTIVE' | 'PAUSED') => {
    setStatuses((prev) => ({ ...prev, [id]: newStatus }));
  };

  return (
    <div className="space-y-3">
      {algos.map((algo) => {
        const isOpen = expanded === algo.id;
        const currentStatus = statuses[algo.id] ?? algo.status;
        const statusVariant =
          currentStatus === 'ACTIVE' ? 'success' : currentStatus === 'ERROR' ? 'error' : 'warning';

        return (
          <div
            key={algo.id}
            className={`bg-[#151b28] border rounded-lg overflow-hidden transition-colors ${
              currentStatus === 'ACTIVE' ? 'border-[#34d399]/20' : 'border-[#1f2937]'
            }`}
          >
            {/* Accordion header */}
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-[#1c2335]/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : algo.id)}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3 text-left">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#e2e8f0]">{algo.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={
                        algo.marketType === 'futures' ? { color: '#f59e0b', background: '#f59e0b15', border: '1px solid #f59e0b30' } :
                        algo.marketType === 'options' ? { color: '#a78bfa', background: '#a78bfa15', border: '1px solid #a78bfa30' } :
                        { color: '#34d399', background: '#34d39915', border: '1px solid #34d39930' }
                      }>
                      {algo.marketType === 'forex' ? 'Forex' : algo.marketType === 'futures' ? 'Futures' : 'Options'}
                    </span>
                    <Badge variant={statusVariant}>{currentStatus}</Badge>
                  </div>
                  <span className="text-xs text-[#475569]">
                    {algo.instrument}
                    {algo.direction && algo.direction !== 'both' && ` · ${algo.direction === 'long' ? 'Long bias' : 'Short bias'}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-[#475569]">P&L Today</div>
                  <div className={`text-sm font-bold font-mono ${algo.pnlToday >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                    {algo.pnlToday >= 0 ? '+' : ''}${algo.pnlToday.toFixed(2)}
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-xs text-[#475569]">Win Rate</div>
                  <div className="text-sm font-bold font-mono text-[#22d3ee]">{algo.winRate}%</div>
                </div>
                {isOpen
                  ? <ChevronUp size={16} className="text-[#94a3b8] flex-shrink-0" />
                  : <ChevronDown size={16} className="text-[#94a3b8] flex-shrink-0" />}
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-[#1f2937] p-4 space-y-5">
                {/* Stats card + equity curve side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <AlgoCard {...algo} status={currentStatus} />
                  <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4">
                    <p className="text-xs text-[#475569] mb-3 uppercase tracking-wider font-medium">
                      Equity Curve (30 days)
                    </p>
                    <EquityCurve height={110} />
                  </div>
                </div>

                {/* Control panel */}
                <ControlPanel
                  algoId={algo.id}
                  algoName={algo.name}
                  status={currentStatus}
                  onStatusChange={handleStatusChange}
                />

                {/* Open positions — live P&L */}
                <OpenPositionsPanel
                  algoId={algo.id}
                  linkedBotAccountId={algo.linkedBotAccountId ?? null}
                />

                {/* Quant models */}
                <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4">
                  <p className="text-xs text-[#475569] mb-1 uppercase tracking-wider font-medium">
                    Quantitative Engine State
                  </p>
                  <QuantModelsPanel
                    marketType={algo.marketType}
                    algoId={algo.id}
                    parameters={algo.parameters}
                  />
                </div>

                {/* Recent trades */}
                <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4">
                  <p className="text-xs text-[#475569] mb-3 uppercase tracking-wider font-medium">
                    Recent Trades
                  </p>
                  <TradesTable trades={[]} maxRows={5} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
