'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { SimulatedTrade } from '@/types/backtest';

interface Props {
  trades: SimulatedTrade[];
  pageSize?: number;
}

type SortKey = 'exitTs' | 'pnl' | 'bars' | 'side';
type SortDir = 'asc' | 'desc';

const REASON_COLOR: Record<SimulatedTrade['exitReason'], string> = {
  tp: 'text-[#34d399]',
  sl: 'text-[#ef4444]',
  signal: 'text-[#06b6d4]',
  eod: 'text-[#94a3b8]',
  margin: 'text-[#f59e0b]',
};

export function BacktestTradesTable({ trades, pageSize = 30 }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('exitTs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'exitTs') { av = a.exitTs; bv = b.exitTs; }
      else if (sortKey === 'pnl')  { av = a.pnl;  bv = b.pnl; }
      else if (sortKey === 'bars') { av = a.bars; bv = b.bars; }
      else if (sortKey === 'side') { av = a.side; bv = b.side; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const start = page * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  if (trades.length === 0) {
    return <div className="text-[10px] text-[#475569] italic py-2">No trades</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded border border-[#1f2937]">
        <table className="w-full text-[11px]">
          <thead className="bg-[#0a0e1a] text-[#475569] uppercase tracking-wider">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              <Th onClick={() => toggleSort('side')} active={sortKey === 'side'}>Side</Th>
              <th className="px-2 py-1 text-left">Entry</th>
              <Th onClick={() => toggleSort('exitTs')} active={sortKey === 'exitTs'}>Exit</Th>
              <th className="px-2 py-1 text-right">Px in</th>
              <th className="px-2 py-1 text-right">Px out</th>
              <th className="px-2 py-1 text-right">Lots</th>
              <Th onClick={() => toggleSort('bars')} active={sortKey === 'bars'} align="right">Bars</Th>
              <Th onClick={() => toggleSort('pnl')}  active={sortKey === 'pnl'}  align="right">P&L</Th>
              <th className="px-2 py-1 text-center">Why</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t.id} className="border-t border-[#1f2937] hover:bg-[#0f1322]">
                <td className="px-2 py-1 text-[#475569] font-mono">{t.id}</td>
                <td className={`px-2 py-1 font-bold ${t.side === 'long' ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                  {t.side.toUpperCase()}
                </td>
                <td className="px-2 py-1 text-[#94a3b8] font-mono whitespace-nowrap">{t.entryTs.slice(5, 16).replace('T', ' ')}</td>
                <td className="px-2 py-1 text-[#94a3b8] font-mono whitespace-nowrap">{t.exitTs.slice(5, 16).replace('T', ' ')}</td>
                <td className="px-2 py-1 text-right font-mono">{t.entryPrice.toFixed(5)}</td>
                <td className="px-2 py-1 text-right font-mono">{t.exitPrice.toFixed(5)}</td>
                <td className="px-2 py-1 text-right font-mono">{t.lots.toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-[#94a3b8] font-mono">{t.bars}</td>
                <td className={`px-2 py-1 text-right font-bold font-mono ${t.pnl >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                </td>
                <td className={`px-2 py-1 text-center text-[10px] font-bold uppercase ${REASON_COLOR[t.exitReason]}`}>
                  {t.exitReason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-2 text-[10px] text-[#94a3b8]">
          <span>Showing {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-0.5 rounded border border-[#1f2937] disabled:opacity-30"
            >Prev</button>
            <span className="px-2 py-0.5">{page + 1}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-0.5 rounded border border-[#1f2937] disabled:opacity-30"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick, active, align }: { children: React.ReactNode; onClick: () => void; active: boolean; align?: 'right' | 'left' }) {
  return (
    <th
      onClick={onClick}
      className={`px-2 py-1 cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-[#06b6d4]' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}<ArrowUpDown size={9} />
      </span>
    </th>
  );
}
