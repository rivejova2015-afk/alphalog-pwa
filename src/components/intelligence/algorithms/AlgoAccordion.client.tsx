'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Key, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlgoCard } from './AlgoCard';
import { TradesTable } from './TradesTable';
import { EquityCurve } from './EquityCurve';
import { ControlPanel } from './ControlPanel.client';
import { QuantModelsPanel } from './QuantModelsPanel';
import { OpenPositionsPanel } from './OpenPositionsPanel.client';
import { BacktestPanel } from './BacktestPanel.client';
import { EngineBacktestPanel } from './EngineBacktestPanel.client';
import { Badge } from '@/components/shared/Badge';
import AlgorithmDetailsModal from './AlgorithmDetailsModal.client';

type MarketType = 'forex' | 'futures' | 'options' | 'crypto';
type Direction  = 'long' | 'short' | 'both';

interface AlgoData {
  id: string;
  name: string;
  marketType: MarketType;
  instrument: string[];
  direction?: Direction;
  parameters?: Record<string, unknown>;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  algoStatus?: string;
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

function formatInstruments(xs: string[]): string {
  if (!xs || xs.length === 0) return '—';
  if (xs.length <= 3) return xs.join(', ');
  return `${xs.slice(0, 3).join(', ')} +${xs.length - 3} más`;
}

export function AlgoAccordion({ algos }: AlgoAccordionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(algos[0]?.id ?? null);
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AlgoData['status']>>(
    Object.fromEntries(algos.map((a) => [a.id, a.status]))
  );
  const [algoStatuses, setAlgoStatuses] = useState<Record<string, string>>(
    Object.fromEntries(algos.map((a) => [a.id, a.algoStatus ?? 'draft']))
  );

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/algorithms/${id}/approve`, { method: 'POST' });
      if (!res.ok) { toast.error('No se pudo aprobar el algoritmo'); return; }
      setAlgoStatuses((prev) => ({ ...prev, [id]: 'approved' }));
      toast.success('Algoritmo aprobado');
    } catch { toast.error('Error de conexión'); }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/algorithms/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || 'No se pudo eliminar la estrategia');
        return;
      }
      toast.success(`"${name}" eliminada`);
      setConfirmDeleteId(null);
      router.refresh();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    setStatuses((prev) => {
      const updated = { ...prev };
      algos.forEach((a) => { if (!(a.id in updated)) updated[a.id] = a.status; });
      return updated;
    });
    setAlgoStatuses((prev) => {
      const updated = { ...prev };
      algos.forEach((a) => { if (!(a.id in updated)) updated[a.id] = a.algoStatus ?? 'draft'; });
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
            <div
              className="w-full flex items-center justify-between p-4 hover:bg-[#1c2335]/50 transition-colors cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : algo.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpanded(isOpen ? null : algo.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3 text-left min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#e2e8f0]">{algo.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={
                        algo.marketType === 'futures' ? { color: '#f59e0b', background: '#f59e0b15', border: '1px solid #f59e0b30' } :
                        algo.marketType === 'options' ? { color: '#a78bfa', background: '#a78bfa15', border: '1px solid #a78bfa30' } :
                        algo.marketType === 'crypto'  ? { color: '#22d3ee', background: '#22d3ee15', border: '1px solid #22d3ee30' } :
                        { color: '#34d399', background: '#34d39915', border: '1px solid #34d39930' }
                      }>
                      {algo.marketType === 'forex' ? 'Forex' : algo.marketType === 'futures' ? 'Futures' : algo.marketType === 'crypto' ? 'Crypto' : 'Options'}
                    </span>
                    <Badge variant={statusVariant}>{currentStatus}</Badge>
                    {(() => {
                      const ls = algoStatuses[algo.id] ?? algo.algoStatus ?? 'draft';
                      const lifecycleColor: Record<string, string> = {
                        draft: '#94a3b8', paper: '#f59e0b', approved: '#22d3ee', live: '#34d399',
                        paused: '#f97316', archived: '#475569',
                      };
                      return (
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ color: lifecycleColor[ls] ?? '#94a3b8', background: `${lifecycleColor[ls] ?? '#94a3b8'}15`, border: `1px solid ${lifecycleColor[ls] ?? '#94a3b8'}30` }}
                        >{ls}</span>
                      );
                    })()}
                    {(algoStatuses[algo.id] ?? algo.algoStatus) === 'paper' && (
                      <button
                        type="button"
                        onClick={(e) => handleApprove(algo.id, e)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/60 transition-colors"
                        aria-label={`Aprobar ${algo.name}`}
                      >
                        <CheckCircle className="w-3 h-3" /> Aprobar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsOpenId(algo.id);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-700/50 text-cyan-300 hover:bg-cyan-800/60 transition-colors"
                      aria-label={`Ver detalles de conexión de ${algo.name}`}
                    >
                      <Key className="w-3 h-3" /> Detalles
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(algo.id);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-300 hover:bg-red-800/60 transition-colors"
                      aria-label={`Eliminar ${algo.name}`}
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                  <span className="text-xs text-[#475569]">
                    {formatInstruments(algo.instrument)}
                    {algo.direction && algo.direction !== 'both' && ` · ${algo.direction === 'long' ? 'Long bias' : 'Short bias'}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-[#475569] flex items-center justify-end gap-1">
                    P&L Today
                    <span className="text-[7px] font-bold font-mono px-1 py-px rounded border border-[#34d399]/40 bg-[#34d399]/10 text-[#34d399] uppercase tracking-wider">
                      Live
                    </span>
                  </div>
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
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-[#1f2937] p-4 space-y-5">
                {/* Stats card + equity curve side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <AlgoCard {...algo} instrument={formatInstruments(algo.instrument)} status={currentStatus} />
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

                {/* Backtest & Validation */}
                <BacktestPanel
                  algorithmId={algo.id}
                  defaultSymbol={algo.instrument[0] ?? 'XAUUSD'}
                  defaultParameters={algo.parameters}
                />

                {/* Engine v1 backtest — direct evaluator + ATR-sized trades */}
                <EngineBacktestPanel
                  algorithmId={algo.id}
                  instruments={algo.instrument}
                />

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

      {detailsOpenId && (
        <AlgorithmDetailsModal
          algorithmId={detailsOpenId}
          algorithmName={algos.find((a) => a.id === detailsOpenId)?.name ?? ''}
          onClose={() => setDetailsOpenId(null)}
        />
      )}

      {confirmDeleteId && (() => {
        const target = algos.find((a) => a.id === confirmDeleteId);
        if (!target) return null;
        const isDeleting = deletingId === target.id;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setConfirmDeleteId(null); }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-[#1f2937] bg-[#0d1117] p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-[#e2e8f0] mb-2">Eliminar estrategia</h3>
              <p className="text-xs text-[#94a3b8] mb-4">
                Vas a eliminar <span className="font-mono text-[#e2e8f0]">&ldquo;{target.name}&rdquo;</span>.
                Esta acción se puede revertir desde la base de datos, pero el bot dejará de operarla.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1f2937] text-[#94a3b8] hover:border-[#475569] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDelete(target.id, target.name)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
