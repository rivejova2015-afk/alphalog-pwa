"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Regime = "TRENDING_HIGH" | "TRENDING_LOW" | "RANGE_HIGH" | "RANGE_LOW" | "DEAD";
type StrategyId = "A" | "B" | "M" | "P";

interface RegimeDistribution {
  regime: Regime;
  hours: number;
  pct: number;
}

interface RecentTrade {
  id: string;
  symbol: string;
  strategyId: string;
  direction: "BUY" | "SELL";
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  exitReason: string | null;
  openedAt: string;
  closedAt: string | null;
  regime: string | null;
  status: string | null;
}

interface StrategyStat {
  enters: number;
  exits: number;
  winRate: number;
  pnlUsd: number;
  isCurrentlyDispatched: boolean;
}

interface SkipReason {
  reason: string;
  strategyId: string;
  count: number;
}

export interface MonitoringData {
  regimeDistribution24h: RegimeDistribution[];
  recentTrades: RecentTrade[];
  perStrategyStats: Record<StrategyId, StrategyStat>;
  topSkipReasons6h: SkipReason[];
  currentRegime: string | null;
  dispatchedStrategy: string | null;
}

// ─── Visual config ───────────────────────────────────────────────────────────

const REGIME_COLOR: Record<Regime, { bar: string; text: string; label: string }> = {
  TRENDING_HIGH: { bar: "bg-emerald-500",  text: "text-emerald-300", label: "Trend·High" },
  TRENDING_LOW:  { bar: "bg-cyan-500",     text: "text-cyan-300",    label: "Trend·Low" },
  RANGE_HIGH:    { bar: "bg-amber-500",    text: "text-amber-300",   label: "Range·High" },
  RANGE_LOW:     { bar: "bg-violet-500",   text: "text-violet-300",  label: "Range·Low" },
  DEAD:          { bar: "bg-slate-600",    text: "text-slate-400",   label: "Dead" },
};

const STRATEGY_LABEL: Record<StrategyId, string> = {
  A: "A · SMC strict",
  B: "B · SMC aggressive",
  M: "M · Mean-reversion",
  P: "P · Momentum",
};

// ─── Top-level component ─────────────────────────────────────────────────────

/**
 * Coinarb monitoring tab — observability widgets fed by the
 * `/api/algorithms/[id]/monitoring` endpoint. Auto-refreshes every 15s in
 * sync with the bot tick. Mobile-first: stacks vertical on small screens,
 * 2×2 grid from md breakpoint up.
 *
 * Empty states aren't hidden — they explicitly say "sin datos aún" so the
 * operator knows the widget loaded but has nothing to show, not that it
 * silently failed.
 */
export function CoinarbMonitoringPanel({ algorithmId }: { algorithmId: string }) {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/algorithms/${algorithmId}/monitoring`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setErrored(true);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.monitoring);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [algorithmId]);

  if (!loaded) return <PanelSkeleton />;
  if (errored || !data) {
    return (
      <div className="rounded-lg bg-[#151b28] border border-dashed border-[#1f2937] p-4 text-center" role="alert">
        <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
        <p className="text-xs text-slate-500">No se pudo cargar el monitoring. Reintentando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="coinarb-monitoring-panel">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" /> Monitoring
        </span>
        <span className="text-[10px] text-slate-500 font-mono">refresh 15s</span>
      </div>

      {/* Mobile: stack vertical. md+: 2-col grid. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RegimeDistribution24hWidget data={data.regimeDistribution24h} />
        <PerStrategyStatsWidget stats={data.perStrategyStats} />
        <RecentTradesWidget trades={data.recentTrades} />
        <TopSkipReasonsWidget reasons={data.topSkipReasons6h} />
      </div>
    </div>
  );
}

// ─── Widget 1: Distribución de régimen 24h ───────────────────────────────────

export function RegimeDistribution24hWidget({ data }: { data: RegimeDistribution[] }) {
  const total = data.reduce((acc, d) => acc + d.hours, 0);
  const hasData = total > 0;

  return (
    <div
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="regime-distribution-24h"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-slate-500">Régimen últimas 24h</h3>
        <span className="text-[10px] font-mono text-slate-600">{total.toFixed(1)}h scored</span>
      </div>
      {!hasData ? (
        <p className="text-xs text-slate-500 py-3 text-center">
          Sin datos aún · el bot está hidratando el classifier
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((d) => {
            const cfg = REGIME_COLOR[d.regime];
            const pctPx = Math.max(2, d.pct * 100);
            return (
              <li key={d.regime} className="flex items-center gap-2 text-xs">
                <span className={`w-20 ${cfg.text} font-mono`}>{cfg.label}</span>
                <div className="flex-1 h-3 bg-[#0a0e1a] rounded overflow-hidden">
                  <div
                    className={`h-full ${cfg.bar} transition-all`}
                    style={{ width: `${pctPx}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-slate-400">
                  {(d.pct * 100).toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Widget 2: Per-strategy stats ────────────────────────────────────────────

export function PerStrategyStatsWidget({ stats }: { stats: Record<StrategyId, StrategyStat> }) {
  return (
    <div
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-3"
      data-testid="per-strategy-stats"
    >
      <h3 className="text-xs uppercase tracking-wider text-slate-500">Por estrategia · últ. 24h</h3>
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B", "M", "P"] as StrategyId[]).map((sid) => {
          const s = stats[sid] ?? { enters: 0, exits: 0, winRate: 0, pnlUsd: 0, isCurrentlyDispatched: false };
          const dispatched = s.isCurrentlyDispatched;
          const pnlPositive = s.pnlUsd > 0;
          return (
            <div
              key={sid}
              className={`bg-[#0a0e1a] rounded p-2 border ${dispatched ? "border-cyan-600" : "border-transparent"}`}
              data-testid={`strategy-tile-${sid}`}
              data-dispatched={dispatched ? "true" : "false"}
              title={STRATEGY_LABEL[sid]}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-400">{sid}</span>
                {dispatched && (
                  <span className="text-[8px] font-bold bg-cyan-700/40 text-cyan-300 px-1 rounded">
                    LIVE
                  </span>
                )}
              </div>
              <div className="text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Enters</span>
                  <span className="font-mono text-slate-200">{s.enters}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">WinRate</span>
                  <span className="font-mono text-slate-200">
                    {s.exits > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PnL</span>
                  <span
                    className={`font-mono ${
                      pnlPositive ? "text-emerald-400" : s.pnlUsd < 0 ? "text-red-400" : "text-slate-200"
                    }`}
                  >
                    {fmt$(s.pnlUsd, true)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Widget 3: Últimos trades ────────────────────────────────────────────────

export function RecentTradesWidget({ trades }: { trades: RecentTrade[] }) {
  return (
    <div
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="recent-trades"
    >
      <h3 className="text-xs uppercase tracking-wider text-slate-500">Últimos trades</h3>
      {trades.length === 0 ? (
        <p className="text-xs text-slate-500 py-3 text-center">
          Sin trades aún · primer ENTER pendiente
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="px-1 py-1 font-normal">Sym</th>
                <th className="px-1 py-1 font-normal">Str</th>
                <th className="px-1 py-1 font-normal">Dir</th>
                <th className="px-1 py-1 font-normal text-right">PnL</th>
                <th className="px-1 py-1 font-normal">Out</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const open = t.status === "OPEN" || t.exitPrice === null;
                const pnl = t.pnlUsd ?? 0;
                return (
                  <tr key={t.id} className="border-t border-[#1f2937]">
                    <td className="px-1 py-1 font-mono text-slate-200">{t.symbol.split("-")[0]}</td>
                    <td className="px-1 py-1 font-mono text-slate-300">{t.strategyId}</td>
                    <td className="px-1 py-1">
                      {t.direction === "BUY" ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                    </td>
                    <td
                      className={`px-1 py-1 text-right font-mono ${
                        open ? "text-slate-500" : pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-red-400" : "text-slate-300"
                      }`}
                    >
                      {open ? "open" : fmt$(pnl, true)}
                    </td>
                    <td className="px-1 py-1 text-slate-400 font-mono">{t.exitReason ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Widget 4: Top razones de SKIP ───────────────────────────────────────────

export function TopSkipReasonsWidget({ reasons }: { reasons: SkipReason[] }) {
  const total = reasons.reduce((acc, r) => acc + r.count, 0);
  return (
    <div
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="top-skip-reasons"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-slate-500">Top SKIPs · últ. 6h</h3>
        <span className="text-[10px] font-mono text-slate-600">{total} total</span>
      </div>
      {reasons.length === 0 ? (
        <p className="text-xs text-slate-500 py-3 text-center">Sin SKIPs registrados</p>
      ) : (
        <ul className="space-y-1">
          {reasons.map((r) => {
            const shortReason = r.reason.length > 50 ? r.reason.slice(0, 50) + "…" : r.reason;
            return (
              <li
                key={`${r.strategyId}::${r.reason}`}
                className="flex items-center gap-2 text-[11px]"
                title={`${r.strategyId}: ${r.reason}`}
              >
                <span className="font-mono text-slate-500 w-5">{r.strategyId}</span>
                <span className="flex-1 text-slate-300 truncate">{shortReason}</span>
                <span className="font-mono text-slate-400 w-10 text-right">{r.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="space-y-4" data-testid="monitoring-skeleton">
      <div className="h-4 bg-slate-800 rounded w-1/4 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2">
            <div className="h-3 bg-slate-800 rounded w-1/3 animate-pulse" />
            <div className="h-2 bg-slate-800 rounded w-full animate-pulse" />
            <div className="h-2 bg-slate-800 rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt$(v: number, signed = false): string {
  // Render signs OUTSIDE the dollar glyph: '+$5.12', '-$2.40', '$0.00'.
  // The default `(-2.4).toFixed(2)` produces '-2.40' which would leave us
  // with '$-2.40' — flip the order so the sign always comes first.
  if (v === 0) return signed ? "$0.00" : "$0.00";
  const abs = Math.abs(v).toFixed(2);
  if (v < 0) return `-$${abs}`;
  return `${signed ? "+" : ""}$${abs}`;
}
