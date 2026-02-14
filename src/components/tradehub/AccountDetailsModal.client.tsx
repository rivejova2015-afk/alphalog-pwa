"use client";

import { useEffect, useMemo, useState } from "react";
import { computePnlTotals, filterTradesForPnl } from "@/lib/metrics/pnl";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";

type Trade = {
  id: string;
  symbol: string;
  direction: string | null;
  status: string | null;
  entry_date: string | null;
  exit_date: string | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  notes: string | null;
  lots?: number | null;
  stop_loss_price?: number | null;
  take_profit_price?: number | null;
  tags?: string[] | null;
  setup?: { id: string; name: string | null } | null;
};

const RANGE_OPTIONS = [
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "120", label: "120d" },
  { value: "365", label: "365d" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

type Props = {
  open: boolean;
  accountId: string;
  accountName: string;
  currency?: string;
  balance?: number | null;
  equity?: number | null;
  status?: string;
  onClose: () => void;
};

function formatCurrency(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch (_e) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeSummary(trades: Trade[]) {
  const metrics = computePnlTotals(trades, {
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: true,
  });
  const wins = metrics.wins;
  const losses = metrics.losses;
  const ops = metrics.ops;
  const winRate = metrics.winRate !== null ? Math.round(metrics.winRate) : null;

  const closed = filterTradesForPnl(trades, {
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: true,
  });
  const setupCounts = new Map<string, { name: string; count: number }>();
  closed.forEach((t) => {
    const key = t.setup?.name || "Sin setup";
    const current = setupCounts.get(key) ?? { name: key, count: 0 };
    setupCounts.set(key, { name: current.name, count: current.count + 1 });
  });
  const topSetups = Array.from(setupCounts.values()).sort((a, b) => b.count - a.count).slice(0, 3);

  return { wins, losses, ops, winRate, topSetups };
}

export default function AccountDetailsModal({
  open,
  accountId,
  accountName,
  currency,
  balance,
  equity,
  status,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"summary" | "trades" | "notes">("summary");
  const [range, setRange] = useState<string>("30");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    return subscribeTradeUpdates(() => {
      setRefreshTick((prev) => prev + 1);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          accountId,
          closedOnly: "true",
          range,
          limit: "50",
          offset: "0",
        });
        const res = await fetch(`/api/tradehub/trades?${params.toString()}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar los trades");
        }
        setTrades(Array.isArray(data) ? data : []);
        setOffset(50);
        setHasMore((Array.isArray(data) ? data : []).length === 50);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar";
        setError(message);
        setTrades([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [accountId, open, range, refreshTick]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const params = new URLSearchParams({
        accountId,
        closedOnly: "true",
        range,
        limit: "50",
        offset: String(offset),
      });
      const res = await fetch(`/api/tradehub/trades?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.error || "Error al cargar más trades");
      }
      const list = Array.isArray(data) ? data : [];
      setTrades((prev) => [...prev, ...list]);
      setOffset(offset + 50);
      setHasMore(list.length === 50);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar";
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = useMemo(() => computeSummary(trades), [trades]);
  const notes = useMemo(() => trades.filter((t) => t.notes && t.notes.trim()), [trades]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Detalles de cuenta</h2>
            <p className="text-sm text-slate-400">{accountName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center gap-4">
          <div className="text-sm text-slate-300">Estado: <span className="font-semibold text-slate-50">{status || "Activa"}</span></div>
          <div className="text-sm text-slate-300">Balance: <span className="font-semibold text-slate-50">{formatCurrency(balance ?? null, currency)}</span></div>
          <div className="text-sm text-slate-300">Equity: <span className="font-semibold text-slate-50">{formatCurrency(equity ?? null, currency)}</span></div>
          <div className="text-sm text-slate-300">Riesgo/trade: <span className="font-semibold text-slate-50">—</span></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">Rango:</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-50 text-sm"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 pt-4 flex items-center gap-3 border-b border-slate-800">
          {(["summary", "trades", "notes"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-sm rounded-t-md ${tab === key ? "text-white border-b-2 border-blue-500" : "text-slate-400"}`}
            >
              {key === "summary" ? "Resumen" : key === "trades" ? "Trades" : "Notes"}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-900/20 border border-red-800 text-sm text-red-200">{error}</div>
          )}

          {tab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm text-slate-400">Winrate</div>
                <div className="text-2xl font-semibold text-slate-50">{summary.winRate !== null ? `${summary.winRate}%` : "—"}</div>
                <div className="text-xs text-slate-500">Ops: {summary.ops}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm text-slate-400">Operaciones</div>
                <div className="text-2xl font-semibold text-slate-50">{summary.ops}</div>
                <div className="text-xs text-slate-500">Wins: {summary.wins} · Losses: {summary.losses}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="text-sm text-slate-400">Top 3 setups</div>
                <div className="space-y-1 mt-2">
                  {summary.topSetups.length === 0 && <div className="text-xs text-slate-500">Sin datos</div>}
                  {summary.topSetups.map((s) => (
                    <div key={s.name} className="text-sm text-slate-100 flex justify-between">
                      <span>{s.name}</span>
                      <span className="text-slate-400">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "trades" && (
            <div className="space-y-3">
              {loading && <div className="text-sm text-slate-400">Cargando trades...</div>}
              {!loading && trades.length === 0 && <div className="text-sm text-slate-400">Sin trades cerrados en este rango.</div>}
              {!loading && trades.length > 0 && (
                <div className="max-w-full overflow-x-auto">
                  <table className="table-mobile-cards min-w-full text-sm text-slate-200">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Symbol</th>
                        <th className="px-3 py-2 text-left">Setup</th>
                        <th className="px-3 py-2 text-right">PNL</th>
                        <th className="px-3 py-2 text-right">R</th>
                        <th className="px-3 py-2 text-left">Dir</th>
                        <th className="px-3 py-2 text-right">Size</th>
                        <th className="px-3 py-2 text-left">Exit</th>
                        <th className="px-3 py-2 text-right">Entry Px</th>
                        <th className="px-3 py-2 text-right">Exit Px</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                        <th className="px-3 py-2 text-left">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => (
                        <tr key={t.id} className="border-b border-slate-800/60">
                          <td data-label="Symbol" className="px-3 py-2">{t.symbol}</td>
                          <td data-label="Setup" className="px-3 py-2">{t.setup?.name || "—"}</td>
                          <td data-label="PNL" className={`px-3 py-2 text-right ${t.pnl && t.pnl > 0 ? "text-green-400" : t.pnl && t.pnl < 0 ? "text-red-400" : "text-slate-200"}`}>
                            {formatCurrency(t.pnl ?? null, currency)}
                          </td>
                          <td data-label="R" className="px-3 py-2 text-right">—</td>
                          <td data-label="Dir" className="px-3 py-2">{t.direction || "—"}</td>
                          <td data-label="Size" className="px-3 py-2 text-right">{formatNumber(t.lots ?? null)}</td>
                          <td data-label="Exit" className="px-3 py-2">{t.exit_date ? new Date(t.exit_date).toLocaleDateString("es-ES") : "—"}</td>
                          <td data-label="Entry Px" className="px-3 py-2 text-right">{formatNumber(t.entry_price)}</td>
                          <td data-label="Exit Px" className="px-3 py-2 text-right">{formatNumber(t.exit_price)}</td>
                          <td data-label="Notes" className="px-3 py-2 max-w-[160px] truncate" title={t.notes || undefined}>{t.notes || ""}</td>
                          <td data-label="Tags" className="px-3 py-2 text-xs text-slate-400">{t.tags?.length ? t.tags.join(", ") : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
                >
                  {loadingMore ? "Cargando..." : "Cargar más"}
                </button>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div className="space-y-3">
              {loading && <div className="text-sm text-slate-400">Cargando...</div>}
              {!loading && notes.length === 0 && <div className="text-sm text-slate-400">Sin notas en trades cerrados para este rango.</div>}
              {!loading && notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="text-sm text-slate-50 flex justify-between">
                        <span>{t.symbol}</span>
                        <span className="text-slate-400 text-xs">{t.exit_date ? new Date(t.exit_date).toLocaleDateString("es-ES") : "—"}</span>
                      </div>
                      <div className="text-xs text-slate-400">Setup: {t.setup?.name || "—"}</div>
                      <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">{t.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
