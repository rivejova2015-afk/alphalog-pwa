"use client";

import { useCallback, useEffect, useState } from "react";

interface SetupDetailsModalProps {
  open: boolean;
  setupId: string;
  setupName: string;
  onClose: () => void;
}

interface Trade {
  id: string;
  symbol?: string;
  setup_id?: string;
  pnl?: number | null;
  r?: number | null;
  direction?: string;
  size?: number | null;
  exit_date?: string | null;
  entry_price?: number | null;
  exit_price?: number | null;
  notes?: string | null;
  tags?: string[];
}

interface Evidence {
  id: string;
  setup_id?: string | null;
  trade_id?: string | null;
  symbol?: string;
  account_id?: string;
  uploaded_at?: string;
  created_at?: string;
  tags?: string[];
  url?: string;
  file_name?: string;
}

interface KPIs {
  winrate: number | null;
  wins: number;
  losses: number;
  ops: number;
  profitNeto: number;
  lastUsedRange: string | null;
}

type Tab = "resumen" | "trades" | "evidence";

function formatCurrency(value: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function SetupDetailsModal({
  open,
  setupId,
  setupName,
  onClose,
}: SetupDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("resumen");
  const [range, setRange] = useState<"30" | "90" | "120" | "365" | "ytd" | "all">("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [kpis, setKpis] = useState<KPIs>({
    winrate: null,
    wins: 0,
    losses: 0,
    ops: 0,
    profitNeto: 0,
    lastUsedRange: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      setError("");

      // Fetch trades
      const params = new URLSearchParams({
        setupId,
        closedOnly: "true",
        range,
        limit: "200",
        offset: "0",
      });
      const tradesRes = await fetch(`/api/tradehub/trades?${params.toString()}`);
      const tradesData = await tradesRes.json().catch(() => []);
      if (tradesRes.ok) {
        setTrades(Array.isArray(tradesData) ? tradesData : []);
      }

      // Fetch evidence
      const evRes = await fetch(`/api/tradehub/evidence?setupId=${setupId}&range=${range}`);
      const evData = await evRes.json().catch(() => []);
      if (evRes.ok) {
        setEvidence(Array.isArray(evData) ? evData : []);
      }

      // Calculate KPIs
      const closed = (Array.isArray(tradesData) ? tradesData : []).filter(
        (t: Trade) => t.exit_date && t.pnl !== null && t.pnl !== 0
      );

      const wins = closed.filter((t: Trade) => (t.pnl ?? 0) > 0).length;
      const losses = closed.filter((t: Trade) => (t.pnl ?? 0) < 0).length;
      const ops = wins + losses;
      const winrate = ops > 0 ? Math.round((wins / ops) * 100) : null;
      const profitNeto = closed.reduce((sum: number, t: Trade) => sum + (t.pnl ?? 0), 0);
      const lastUsedRange = closed.length > 0 && closed[0]?.exit_date ? closed[0].exit_date : null;

      setKpis({ winrate, wins, losses, ops, profitNeto, lastUsedRange });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar datos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [open, setupId, range]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-4xl w-full mx-4 my-8 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">{setupName}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Range Selector (Global) */}
        <div className="flex flex-wrap gap-2">
          {(["30", "90", "120", "365", "ytd", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {r === "ytd" ? "YTD" : r === "all" ? "All" : `${r}d`}
            </button>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800">
          {(["resumen", "trades", "evidence"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab === "resumen" ? "Resumen" : tab === "trades" ? "Trades" : "Evidence"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Cargando...</div>
        ) : (
          <>
            {/* Resumen Tab */}
            {activeTab === "resumen" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-slate-800 p-4">
                    <div className="text-xs text-slate-400 mb-1">Winrate</div>
                    <div className="text-2xl font-bold text-slate-50">
                      {kpis.winrate !== null ? `${kpis.winrate}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-4">
                    <div className="text-xs text-slate-400 mb-1">Operaciones</div>
                    <div className="text-2xl font-bold text-slate-50">{kpis.ops}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-4">
                    <div className="text-xs text-slate-400 mb-1">Ganancias</div>
                    <div className="text-2xl font-bold text-green-300">{kpis.wins}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-4">
                    <div className="text-xs text-slate-400 mb-1">Pérdidas</div>
                    <div className="text-2xl font-bold text-red-300">{kpis.losses}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800 p-4">
                  <div className="text-sm text-slate-400 mb-2">Profit Neto (rango)</div>
                  <div className={`text-3xl font-bold ${kpis.profitNeto >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {formatCurrency(kpis.profitNeto)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800 p-4">
                  <div className="text-sm text-slate-400">Last Used (rango)</div>
                  <div className="text-slate-50 font-semibold">
                    {formatDate(kpis.lastUsedRange)}
                  </div>
                </div>
              </div>
            )}

            {/* Trades Tab */}
            {activeTab === "trades" && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {trades.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">No hay trades en este rango</div>
                ) : (
                  trades.map((trade) => (
                    <div key={trade.id} className="rounded-lg bg-slate-800 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-50">
                            {trade.symbol} {trade.direction && `• ${trade.direction}`}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Entry: {formatCurrency(trade.entry_price ?? 0)} | Exit: {formatCurrency(trade.exit_price ?? 0)}
                          </div>
                          <div className="text-xs text-slate-400">
                            Size: {trade.size ?? "—"} | R: {trade.r ?? "—"}
                          </div>
                          {trade.notes && (
                            <div className="text-xs text-slate-300 mt-2">{trade.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${(trade.pnl ?? 0) >= 0 ? "text-green-300" : "text-red-300"}`}>
                            {formatCurrency(trade.pnl ?? 0)}
                          </div>
                          <div className="text-xs text-slate-400">{formatDate(trade.exit_date)}</div>
                        </div>
                      </div>
                      {trade.tags && trade.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {trade.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Evidence Tab */}
            {activeTab === "evidence" && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {evidence.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">No hay evidencia en este rango</div>
                ) : (
                  evidence.map((ev) => (
                    <div key={ev.id} className="rounded-lg bg-slate-800 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-50">
                            {ev.file_name || ev.symbol || "Evidencia"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {ev.trade_id && `Trade: ${ev.trade_id.substring(0, 8)}...`}
                            {ev.trade_id && ev.account_id && " • "}
                            {ev.account_id && `Account: ${ev.account_id.substring(0, 8)}...`}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatDate(ev.uploaded_at || ev.created_at)}
                          </div>
                        </div>
                        <button className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">
                          Ver
                        </button>
                      </div>
                      {ev.tags && ev.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ev.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={() => void fetchData()}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
