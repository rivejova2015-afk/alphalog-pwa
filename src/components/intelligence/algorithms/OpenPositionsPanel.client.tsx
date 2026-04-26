'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Activity, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface OpenPosition {
  id: string;
  ticket: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lots: number;
  open_price: number;
  current_price: number | null;
  profit: number;
  sl: number | null;
  tp: number | null;
  open_time: string | null;
  status: 'open' | 'closed';
}

interface ClosedPosition extends OpenPosition {
  close_price: number | null;
  closed_at: string | null;
}

interface Props {
  algoId: string;
  linkedBotAccountId: string | null;
}

function elapsed(openTime: string | null): string {
  if (!openTime) return '—';
  const diffMs = Date.now() - new Date(openTime).getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function OpenPositionsPanel({ algoId, linkedBotAccountId }: Props) {
  const [open, setOpen] = useState<OpenPosition[]>([]);
  const [closedToday, setClosedToday] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  const fetchPositions = useCallback(async () => {
    const [openRes, closedRes] = await Promise.all([
      supabase
        .from('bot_open_positions')
        .select('*')
        .eq('algorithm_id', algoId)
        .eq('bot_account_id', linkedBotAccountId!)
        .eq('status', 'open')
        .order('open_time', { ascending: true }),
      supabase
        .from('bot_open_positions')
        .select('*')
        .eq('algorithm_id', algoId)
        .eq('bot_account_id', linkedBotAccountId!)
        .eq('status', 'closed')
        .gte('closed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('closed_at', { ascending: false })
        .limit(50),
    ]);

    setOpen((openRes.data as OpenPosition[]) ?? []);
    setClosedToday((closedRes.data as ClosedPosition[]) ?? []);
    setLoading(false);
  }, [algoId, linkedBotAccountId, supabase]);

  // Poll every 5s; also tick elapsed timers every second
  useEffect(() => {
    if (!linkedBotAccountId) { setLoading(false); return; }
    fetchPositions();
    const pollId = setInterval(fetchPositions, 5_000);
    const tickId = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => { clearInterval(pollId); clearInterval(tickId); };
  }, [algoId, linkedBotAccountId, fetchPositions]);

  const totalFloat = open.reduce((s, p) => s + p.profit, 0);

  if (!linkedBotAccountId) {
    return (
      <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4">
        <p className="text-xs text-[#475569] uppercase tracking-wider font-medium mb-3">
          Open Positions
        </p>
        <p className="text-xs text-[#334155] italic">Sin cuenta bot vinculada — configura el linked_bot_account_id en la estrategia.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-2">
          <Activity size={14} className={open.length > 0 ? 'text-[#34d399] animate-pulse' : 'text-[#475569]'} />
          <span className="text-xs text-[#475569] uppercase tracking-wider font-medium">
            Open Positions
          </span>
          {open.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20">
              {open.length}
            </span>
          )}
        </div>
        {open.length > 0 && (
          <div className={`text-sm font-bold font-mono ${totalFloat >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
            {totalFloat >= 0 ? '+' : ''}${totalFloat.toFixed(2)}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Open positions */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[#475569]">
            <span className="w-3 h-3 rounded-full border border-[#475569] border-t-transparent animate-spin inline-block" />
            Cargando posiciones…
          </div>
        ) : open.length === 0 ? (
          <p className="text-xs text-[#334155] italic">En espera del engine… (sin posiciones abiertas)</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#475569] border-b border-[#1f2937]">
                    <th className="text-left pb-2 font-medium">Ticket</th>
                    <th className="text-left pb-2 font-medium">Symbol</th>
                    <th className="text-left pb-2 font-medium">Dir</th>
                    <th className="text-right pb-2 font-medium">Lots</th>
                    <th className="text-right pb-2 font-medium">Entry</th>
                    <th className="text-right pb-2 font-medium">Current</th>
                    <th className="text-right pb-2 font-medium">P&L</th>
                    <th className="text-right pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0f1520]">
                  {open.map((pos) => (
                    <tr key={pos.id} className="hover:bg-[#151b28]/40">
                      <td className="py-2 font-mono text-[#94a3b8]">{pos.ticket}</td>
                      <td className="py-2 font-mono text-[#e2e8f0]">{pos.symbol}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          pos.direction === 'BUY'
                            ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                            : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                        }`}>
                          {pos.direction === 'BUY' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {pos.direction}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-[#94a3b8]">{pos.lots}</td>
                      <td className="py-2 text-right font-mono text-[#94a3b8]">{pos.open_price.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-[#e2e8f0]">
                        {pos.current_price != null ? pos.current_price.toFixed(2) : '—'}
                      </td>
                      <td className={`py-2 text-right font-mono font-bold ${pos.profit >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                        {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-mono text-[#475569]">
                        <span className="flex items-center gap-1 justify-end">
                          <Clock size={10} />
                          {elapsed(pos.open_time)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {open.map((pos) => (
                <div key={pos.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        pos.direction === 'BUY'
                          ? 'bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20'
                          : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                      }`}>{pos.direction}</span>
                      <span className="text-xs font-mono text-[#e2e8f0]">{pos.symbol}</span>
                      <span className="text-[10px] font-mono text-[#475569]">{pos.lots} lots</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${pos.profit >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                      {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#475569]">
                    <span>Entry {pos.open_price.toFixed(2)} → {pos.current_price != null ? pos.current_price.toFixed(2) : '—'}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{elapsed(pos.open_time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Closed today */}
        {closedToday.length > 0 && (
          <div>
            <p className="text-[10px] text-[#475569] uppercase tracking-wider font-medium mb-2">
              Cerradas hoy ({closedToday.length})
            </p>
            <div className="space-y-1">
              {closedToday.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between py-1.5 px-2 bg-[#151b28]/60 rounded text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                      pos.direction === 'BUY'
                        ? 'bg-[#34d399]/10 text-[#34d399]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                    }`}>{pos.direction}</span>
                    <span className="font-mono text-[#94a3b8]">{pos.symbol}</span>
                    <span className="font-mono text-[#475569]">
                      {pos.open_price.toFixed(2)} → {pos.close_price != null ? pos.close_price.toFixed(2) : '—'}
                    </span>
                  </div>
                  <span className={`font-mono font-bold ${pos.profit >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                    {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
