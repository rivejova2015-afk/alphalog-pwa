"use client";

import { useEffect, useState } from "react";
import { PieChart, History, ChevronDown, ChevronUp } from "lucide-react";
import { logError } from "@/lib/log";

interface AllocationRow {
  algorithmId: string;
  algorithmName: string;
  marketType: string | null;
  weight: number;
  dailyReturnStdev: number | null;
}

interface AllocationsResponse {
  allocations: AllocationRow[];
  runAt: string | null;
  lookbackDays: number | null;
}

interface HistoryRun {
  runAt: string;
  lookbackDays: number | null;
  allocations: { algorithmId: string; algorithmName: string; weight: number }[];
}

const MARKET_COLORS: Record<string, string> = {
  futures: "#22d3ee",
  forex: "#34d399",
  crypto: "#f59e0b",
  options: "#a78bfa",
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function PortfolioAllocationPanel() {
  const [data, setData] = useState<AllocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRun[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history) return; // ya cargado, no refetch
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/portfolio/allocations/history");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setHistory(json.runs);
    } catch (e) {
      logError("Portfolio", {
        component: "PortfolioAllocationPanel.loadHistory",
        message: "fetch allocations history failed",
        error: e instanceof Error ? e.message : String(e),
      });
      setHistoryError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portfolio/allocations");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e) {
        logError("Portfolio", {
          component: "PortfolioAllocationPanel.load",
          message: "fetch allocations failed",
          error: e instanceof Error ? e.message : String(e),
        });
        if (!cancelled) setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-6 animate-pulse">
        <div className="h-4 w-48 bg-[#1f2937] rounded mb-4" />
        <div className="h-3 w-full bg-[#1f2937] rounded mb-2" />
        <div className="h-3 w-full bg-[#1f2937] rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#151b28] border border-red-900/40 rounded-lg p-6 text-sm text-red-400">
        Error cargando la asignación de portfolio: {error}
      </div>
    );
  }

  if (!data || data.allocations.length === 0) {
    return (
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-6 text-center">
        <PieChart size={28} className="text-[#1f2937] mx-auto mb-3" />
        <p className="text-sm text-[#94a3b8]">Todavía no hay una asignación HRP calculada.</p>
        <p className="text-xs text-[#475569] mt-1">
          El cron semanal <code className="text-[#64748b]">portfolio/rebalance</code> corre los domingos —
          necesita al menos 2 algoritmos con ≥10 días de actividad real para producir pesos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
          <PieChart size={16} className="text-[#22d3ee]" />
          Asignación de Portfolio (HRP)
        </h3>
        {data.runAt && (
          <span className="text-[10px] text-[#475569]">
            Calculado {formatRelative(data.runAt)} · lookback {data.lookbackDays}d
          </span>
        )}
      </div>

      <div className="space-y-3">
        {data.allocations.map((a) => {
          const color = MARKET_COLORS[a.marketType ?? ""] ?? "#94a3b8";
          const pct = (a.weight * 100).toFixed(1);
          return (
            <div key={a.algorithmId}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#cbd5e1] font-medium">{a.algorithmName}</span>
                <span className="text-[#94a3b8] font-mono">{pct}%</span>
              </div>
              <div className="h-2 w-full bg-[#0a0e1a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(2, a.weight * 100)}%`, backgroundColor: color }}
                />
              </div>
              {a.dailyReturnStdev != null && (
                <p className="text-[10px] text-[#475569] mt-0.5">
                  Volatilidad diaria: {(a.dailyReturnStdev * 100).toFixed(2)}%
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[#475569] leading-relaxed pt-2 border-t border-[#1f2937]">
        Hierarchical Risk Parity distribuye capital dando más peso a los algoritmos menos volátiles y menos
        correlacionados con el resto — no es una recomendación de trading, es un input para decidir cuánto
        capital destinarle a cada estrategia.
      </p>

      <div className="pt-2 border-t border-[#1f2937]">
        <button
          type="button"
          onClick={toggleHistory}
          className="flex items-center gap-1.5 text-[10px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
        >
          <History size={11} />
          Ver historial de corridas
          {historyOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {historyOpen && (
          <div className="mt-3 space-y-3">
            {historyLoading && (
              <div className="h-16 bg-[#0a0e1a] rounded animate-pulse" />
            )}
            {historyError && (
              <p className="text-xs text-red-400">Error cargando historial: {historyError}</p>
            )}
            {!historyLoading && !historyError && history && history.length === 0 && (
              <p className="text-xs text-[#475569]">Todavía no hay corridas históricas — esta es la primera.</p>
            )}
            {!historyLoading && !historyError && history && history.length > 0 && (
              <div className="space-y-2">
                {history.map((run) => (
                  <div key={run.runAt} className="rounded-md bg-[#0a0e1a] border border-[#1f2937] p-2.5">
                    <div className="flex items-center justify-between text-[10px] text-[#64748b] mb-1.5">
                      <span>{formatRelative(run.runAt)}</span>
                      <span>lookback {run.lookbackDays}d</span>
                    </div>
                    <div className="space-y-1">
                      {run.allocations.map((a) => (
                        <div key={a.algorithmId} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#94a3b8] truncate">{a.algorithmName}</span>
                          <span className="text-[#cbd5e1] font-mono ml-2">{(a.weight * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfolioAllocationPanel;
