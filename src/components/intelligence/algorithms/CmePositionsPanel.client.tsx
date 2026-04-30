'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, X, RefreshCw } from 'lucide-react';

interface CmePosition {
  id: string;
  contract: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  avg_entry_price: number | null;
  current_price: number | null;
  unrealized_pnl_usd: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  is_manual: boolean;
  opened_at: string | null;
}

interface Props {
  cmeAccountId: string;
}

export default function CmePositionsPanel({ cmeAccountId }: Props) {
  const [positions, setPositions] = useState<CmePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    const res = await fetch(`/api/cme/positions?cmeAccountId=${cmeAccountId}`);
    if (!res.ok) return;
    const { data } = await res.json();
    setPositions(data ?? []);
  }, [cmeAccountId]);

  useEffect(() => {
    setLoading(true);
    fetchPositions().finally(() => setLoading(false));
    const interval = setInterval(fetchPositions, 10_000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  async function handleClose(positionId: string) {
    setClosing(positionId);
    try {
      const res = await fetch(`/api/cme/positions/${positionId}/close`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to close position');
        return;
      }
      toast.success('Position closed');
      fetchPositions();
    } finally {
      setClosing(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!positions.length) {
    return (
      <p className="text-sm text-white/40 py-4 text-center">No open positions</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/60">{positions.length} open position{positions.length !== 1 ? 's' : ''}</span>
        <button
          onClick={fetchPositions}
          className="text-white/40 hover:text-white/80 transition-colors"
          aria-label="Refresh positions"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {positions.map(pos => {
        const pnl = pos.unrealized_pnl_usd ?? 0;
        const isLong = pos.direction === 'LONG';
        return (
          <div
            key={pos.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div className={`flex-shrink-0 ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{pos.contract}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {pos.direction}
                </span>
                {pos.is_manual && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
                <span>Qty: {pos.quantity}</span>
                {pos.avg_entry_price && <span>Entry: {pos.avg_entry_price}</span>}
              </div>
            </div>

            <div className="text-right">
              <span className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => handleClose(pos.id)}
              disabled={closing === pos.id}
              className="flex-shrink-0 p-1.5 rounded text-white/40 hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
              aria-label="Close position"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
