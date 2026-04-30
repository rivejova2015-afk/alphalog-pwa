'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';

interface CmeTrade {
  id: string;
  contract: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  fill_price: number | null;
  entry_price: number | null;
  exit_price: number | null;
  status: string;
  pnl_usd: number | null;
  commission_usd: number | null;
  slippage_ticks: number | null;
  close_reason: string | null;
  fill_timestamp: string | null;
  created_at: string;
}

interface Props {
  cmeAccountId: string;
  tableType: 'propfirm' | 'real';
}

export default function CmeTradesTable({ cmeAccountId, tableType }: Props) {
  const [trades, setTrades] = useState<CmeTrade[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchTrades = useCallback(async () => {
    const url = `/api/cme/trades/${tableType}?cmeAccountId=${cmeAccountId}&limit=${limit}&offset=${page * limit}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const { data, count: total } = await res.json();
    setTrades(data ?? []);
    setCount(total ?? 0);
  }, [cmeAccountId, tableType, page]);

  useEffect(() => {
    setLoading(true);
    fetchTrades().finally(() => setLoading(false));
  }, [fetchTrades]);

  async function handleExport() {
    const url = `/api/cme/trades/${tableType}?cmeAccountId=${cmeAccountId}&format=csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `cme-trades-${tableType}.csv`;
    a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/60">{count} trades total</span>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:text-white hover:bg-white/10 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <p className="text-sm text-white/30 py-6 text-center">No trades yet</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/40 border-b border-white/10">
                  <th className="text-left py-2 pr-4">Contract</th>
                  <th className="text-left py-2 pr-4">Dir</th>
                  <th className="text-left py-2 pr-4">Qty</th>
                  <th className="text-left py-2 pr-4">Fill</th>
                  <th className="text-left py-2 pr-4">P&L</th>
                  <th className="text-left py-2 pr-4">Slippage</th>
                  <th className="text-left py-2 pr-4">Reason</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => {
                  const pnl = t.pnl_usd;
                  return (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-4 font-medium text-white">{t.contract}</td>
                      <td className="py-2 pr-4">
                        <span className={t.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-white/70">{t.quantity}</td>
                      <td className="py-2 pr-4 text-white/70">{t.fill_price?.toFixed(4) ?? '—'}</td>
                      <td className={`py-2 pr-4 font-medium ${pnl == null ? 'text-white/30' : pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnl != null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-white/50">{t.slippage_ticks != null ? `${t.slippage_ticks}t` : '—'}</td>
                      <td className="py-2 pr-4 text-white/50 capitalize">{t.close_reason?.replace('_', ' ') ?? '—'}</td>
                      <td className="py-2 text-white/40 text-xs">
                        {t.fill_timestamp
                          ? new Date(t.fill_timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {count > limit && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs disabled:opacity-30 hover:bg-white/10 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-white/40">
                {page + 1} / {Math.ceil(count / limit)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * limit >= count}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs disabled:opacity-30 hover:bg-white/10 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
