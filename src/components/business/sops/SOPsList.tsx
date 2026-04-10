'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

interface SOPItem {
  id: string;
  label: string;
}

interface SOP {
  id: string;
  name: string;
  content: string;
  effectiveness_percent: number;
  linked_trades: number;
  items: SOPItem[];
}

interface SOPsListProps {
  sops?: SOP[];
}

const DEMO_SOPS: SOP[] = [
  {
    id: '1',
    name: 'Pre-Session Trading Checklist',
    content: 'Execute before every trading session to ensure optimal conditions.',
    effectiveness_percent: 92,
    linked_trades: 423,
    items: [
      { id: 'i1', label: 'Check economic calendar for high-impact events' },
      { id: 'i2', label: 'Review overnight price action on XAU/USD' },
      { id: 'i3', label: 'Verify GoldRange EA is running and heartbeat is green' },
      { id: 'i4', label: 'Check account equity and current drawdown level' },
      { id: 'i5', label: 'Set daily loss limit alert in MT5' },
      { id: 'i6', label: 'Review previous day journal notes' },
    ],
  },
  {
    id: '2',
    name: 'Weekly Performance Review',
    content: 'Run every Sunday to evaluate the week and prepare for next.',
    effectiveness_percent: 88,
    linked_trades: 847,
    items: [
      { id: 'i7', label: 'Export weekly trades CSV from MT5' },
      { id: 'i8', label: 'Calculate weekly P&L and compare to target' },
      { id: 'i9', label: 'Identify top 3 winning and losing setups' },
      { id: 'i10', label: 'Update KPI dashboard with weekly metrics' },
      { id: 'i11', label: 'Write weekly journal entry with key learnings' },
      { id: 'i12', label: 'Generate AI report from terminal' },
      { id: 'i13', label: 'Review and update active decisions' },
    ],
  },
  {
    id: '3',
    name: 'New Strategy Deployment',
    content: 'Follow this process before deploying any new algorithm live.',
    effectiveness_percent: 100,
    linked_trades: 0,
    items: [
      { id: 'i14', label: 'Complete backtest on minimum 2 years data' },
      { id: 'i15', label: 'Paper trade for minimum 4 weeks' },
      { id: 'i16', label: 'Review drawdown and profit factor thresholds' },
      { id: 'i17', label: 'Start with minimum lot size (0.01)' },
      { id: 'i18', label: 'Set hard SL at -5% account drawdown' },
      { id: 'i19', label: 'Document strategy in journal with full rationale' },
      { id: 'i20', label: 'Create decision entry with expected impact' },
    ],
  },
];

export function SOPsList({ sops = DEMO_SOPS }: SOPsListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runState, setRunState] = useState<Record<string, Record<string, boolean>>>({});

  const toggleItem = (sopId: string, itemId: string) => {
    setRunState((prev) => ({
      ...prev,
      [sopId]: { ...(prev[sopId] ?? {}), [itemId]: !prev[sopId]?.[itemId] },
    }));
  };

  const resetRun = (sopId: string) => {
    setRunState((prev) => ({ ...prev, [sopId]: {} }));
  };

  return (
    <div className="space-y-3">
      {sops.map((sop) => {
        const isOpen = expanded === sop.id;
        const checkedItems = Object.values(runState[sop.id] ?? {}).filter(Boolean).length;
        const totalItems = sop.items.length;
        const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

        return (
          <div key={sop.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : sop.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#1c2335]/40 transition-colors text-left"
              aria-expanded={isOpen}
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-[#e2e8f0]">{sop.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#475569]">
                  <span className="text-[#34d399] font-mono">{sop.effectiveness_percent}% effective</span>
                  <span>{sop.linked_trades} linked trades</span>
                  <span>{totalItems} steps</span>
                </div>
              </div>
              {isOpen
                ? <ChevronUp size={16} className="text-[#475569] flex-shrink-0" />
                : <ChevronDown size={16} className="text-[#475569] flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="border-t border-[#1f2937] p-4">
                <p className="text-xs text-[#94a3b8] mb-4">{sop.content}</p>

                {/* Run progress */}
                {checkedItems > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#475569]">Run progress</span>
                      <span className="font-mono text-[#22d3ee]">{checkedItems}/{totalItems}</span>
                    </div>
                    <div className="h-1.5 bg-[#0a0e1a] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#22d3ee] rounded transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div className="space-y-2 mb-4">
                  {sop.items.map((item) => {
                    const checked = runState[sop.id]?.[item.id] ?? false;
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(sop.id, item.id)}
                        className="w-full flex items-start gap-3 p-2 rounded hover:bg-[#0a0e1a] transition-colors text-left"
                      >
                        {checked
                          ? <CheckSquare size={16} className="text-[#34d399] flex-shrink-0 mt-0.5" />
                          : <Square size={16} className="text-[#475569] flex-shrink-0 mt-0.5" />}
                        <span className={`text-sm ${checked ? 'text-[#475569] line-through' : 'text-[#94a3b8]'}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                {checkedItems > 0 && (
                  <button
                    onClick={() => resetRun(sop.id)}
                    className="text-xs text-[#475569] hover:text-[#94a3b8] transition-colors"
                  >
                    Reset checklist
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
