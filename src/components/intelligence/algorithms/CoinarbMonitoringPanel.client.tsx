"use client";

/**
 * Coinarb monitoring dashboard — separate tab inside the algorithm modal.
 *
 * 4 widgets, each backed by /api/algorithms/[id]/monitoring (single fetch,
 * 15s refresh, same cadence as TelemetryPanel):
 *
 *   - RegimeDistribution24h — horizontal bars colored by regime
 *   - PerStrategyStats      — 4 mini-tiles, dispatched one gets cyan border
 *   - RecentTradesTable     — last 10 closed positions with PnL
 *   - TopSkipReasons        — ranked list of blocking gates last 6h
 *
 * Mobile-first: `flex-col` until ≥768px, then `grid-cols-2`. Each widget has
 * its own empty state with operator-readable explanation, so the panel reads
 * sensibly when the bot is fresh and has no data yet.
 */

import { useEffect, useState } from "react";
import { Activity, BarChart3, Layers, ListChecks, TrendingDown } from "lucide-react";

type Regime = "TRENDING_HIGH" | "TRENDING_LOW" | "RANGE_HIGH" | "RANGE_LOW" | "DEAD";
type StrategyId = "A" | "B" | "M" | "P";

// Local colors per regime — kept in sync with REGIME_CONFIG in
// CoinarbControlPanel.client.tsx so a regime renders the same hue on both tabs.
const REGIME_BAR_COLOR: Record<Regime, string> = {
  TRENDING_HIGH: "bg-emerald-500",
  TRENDING_LOW: "bg-cyan-500",
  RANGE_HIGH: "bg-amber-500",
  RANGE_LOW: "bg-violet-500",
  DEAD: "bg-slate-600",
};
const REGIME_LABEL: Record<Regime, string> = {
  TRENDING_HIGH: "Trending · High",
  TRENDING_LOW: "Trending · Low",
  RANGE_HIGH: "Range · High",
  RANGE_LOW: "Range · Low",
  DEAD: "Dead",
};

const STRATEGY_LABEL: Record<StrategyId, string> = {
  A: "A · SMC strict",
  B: "B · SMC aggressive",
  M: "M · Mean reversion",
  P: "P · Momentum breakout",
};

interface RegimeBucket {
  regime: Regime;
  hours: number;
  pct: number;
}
interface RecentTrade {
  id: string;
  symbol: string;
  strategyId: StrategyId | null;
  direction: "BUY" | "SELL";
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  exitReason: string | null;
  openedAt: string;
  closedAt: string | null;
  regime: Regime | null;
}
interface StrategyStat {
  enters: number;
  exits: number;
  winRate: number;
  pnlR: number;
  isCurrentlyDispatched: boolean;
}
interface SkipReason {
  reason: string;
  count: number;
  strategyId: StrategyId | null;
}

export interface MonitoringResponse {
  regimeDistribution24h: RegimeBucket[];
  recentTrades: RecentTrade[];
  perStrategyStats: Record<StrategyId, StrategyStat>;
  topSkipReasons6h: SkipReason[];
  currentRegime: Regime | null;
}

export default function CoinarbMonitoringPanel({ algorithmId }: { algorithmId: string }) {
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await fetch(`/api/algorithms/${algorithmId}/monitoring`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            const body = await res.json().catch(() => ({}));
            setErrorMsg(body.error ?? `Error ${res.status}`);
          }
          return;
        }
        const json = (await res.json()) as MonitoringResponse;
        if (!cancelled) {
          setData(json);
          setErrorMsg(null);
        }
      } catch (err) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : "network error");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchOnce();
    const id = setInterval(fetchOnce, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [algorithmId]);

  if (!loaded) return <MonitoringSkeleton />;
  if (errorMsg && !data) {
    return (
      <div
        className="rounded-lg bg-[#151b28] border border-red-900/50 p-4 text-center"
        data-testid="monitoring-error"
      >
        <p className="text-xs text-red-400">No se pudo cargar el monitoring: {errorMsg}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3" data-testid="monitoring-panel">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400" /> Monitoring
        </span>
        <span className="text-[10px] text-slate-500 font-mono">refresh 15s</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RegimeDistribution24h buckets={data.regimeDistribution24h} />
        <PerStrategyStats stats={data.perStrategyStats} />
        <RecentTradesTable trades={data.recentTrades} />
        <TopSkipReasons reasons={data.topSkipReasons6h} />
      </div>
    </div>
  );
}

// ─── RegimeDistribution24h ───────────────────────────────────────────────────

export function RegimeDistribution24h({ buckets }: { buckets: RegimeBucket[] }) {
  return (
    <section
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="widget-regime-distribution"
    >
      <header className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Régimen últimas 24h
        </h3>
      </header>
      {buckets.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic" data-testid="empty-regime-distribution">
          Sin datos todavía. El classifier necesita ~50 minutos de candles 1H acumulados antes
          del primer registro.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {buckets.map((b) => (
            <li
              key={b.regime}
              className="flex items-center gap-2"
              data-testid={`regime-row-${b.regime}`}
            >
              <span className="w-28 text-[11px] text-slate-400 truncate">
                {REGIME_LABEL[b.regime]}
              </span>
              <div className="flex-1 h-2.5 bg-[#0a0e1a] rounded overflow-hidden">
                <div
                  className={`h-full ${REGIME_BAR_COLOR[b.regime]} transition-all`}
                  style={{ width: `${(b.pct * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="w-20 text-right text-[11px] font-mono text-slate-400">
                {(b.pct * 100).toFixed(1)}% · {b.hours}h
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── PerStrategyStats ────────────────────────────────────────────────────────

export function PerStrategyStats({ stats }: { stats: Record<StrategyId, StrategyStat> }) {
  const ids: StrategyId[] = ["A", "B", "M", "P"];
  return (
    <section
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="widget-per-strategy-stats"
    >
      <header className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Per strategy (24h)
        </h3>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {ids.map((sid) => {
          const s = stats[sid];
          const dispatched = s.isCurrentlyDispatched;
          return (
            <div
              key={sid}
              className={`rounded p-2 bg-[#0a0e1a] border ${
                dispatched ? "border-cyan-600" : "border-[#1f2937]"
              }`}
              data-testid={`strategy-tile-${sid}`}
              data-dispatched={dispatched ? "true" : "false"}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-300 truncate" title={STRATEGY_LABEL[sid]}>
                  {STRATEGY_LABEL[sid]}
                </span>
                {dispatched && (
                  <span className="text-[9px] uppercase font-bold text-cyan-400" data-testid={`dispatched-${sid}`}>
                    LIVE
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-y-0.5 text-[10px] font-mono">
                <dt className="text-slate-500">enters</dt>
                <dd className="text-slate-200 text-right">{s.enters}</dd>
                <dt className="text-slate-500">exits</dt>
                <dd className="text-slate-200 text-right">{s.exits}</dd>
                <dt className="text-slate-500">winRate</dt>
                <dd className="text-slate-200 text-right">
                  {s.exits > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "—"}
                </dd>
                <dt className="text-slate-500">pnlR</dt>
                <dd
                  className={`text-right ${
                    s.pnlR > 0 ? "text-emerald-400" : s.pnlR < 0 ? "text-red-400" : "text-slate-300"
                  }`}
                >
                  {s.pnlR > 0 ? "+" : ""}{s.pnlR.toFixed(2)}R
                </dd>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── RecentTradesTable ───────────────────────────────────────────────────────

export function RecentTradesTable({ trades }: { trades: RecentTrade[] }) {
  return (
    <section
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="widget-recent-trades"
    >
      <header className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Últimos trades
        </h3>
      </header>
      {trades.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic" data-testid="empty-recent-trades">
          Sin trades aún. El bot logueará cada posición al cerrar.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-500 border-b border-[#1f2937]">
                <th className="text-left py-1 pr-2 font-normal">Sym</th>
                <th className="text-left py-1 px-1 font-normal">St</th>
                <th className="text-left py-1 px-1 font-normal">Dir</th>
                <th className="text-right py-1 px-1 font-normal">PnL</th>
                <th className="text-left py-1 pl-1 font-normal">Salida</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-[#1f2937]/50" data-testid={`trade-row-${t.id}`}>
                  <td className="py-1 pr-2 font-mono text-slate-300">{t.symbol.split("-")[0]}</td>
                  <td className="py-1 px-1 text-slate-400">{t.strategyId ?? "—"}</td>
                  <td className={`py-1 px-1 font-medium ${t.direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                    {t.direction}
                  </td>
                  <td
                    className={`py-1 px-1 text-right font-mono ${
                      t.pnlUsd === null ? "text-slate-500"
                        : t.pnlUsd > 0 ? "text-emerald-400"
                        : t.pnlUsd < 0 ? "text-red-400"
                        : "text-slate-300"
                    }`}
                  >
                    {t.pnlUsd === null ? "open" : `${t.pnlUsd > 0 ? "+" : ""}$${t.pnlUsd.toFixed(2)}`}
                  </td>
                  <td className="py-1 pl-1 text-slate-400">{t.exitReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── TopSkipReasons ──────────────────────────────────────────────────────────

export function TopSkipReasons({ reasons }: { reasons: SkipReason[] }) {
  const maxCount = reasons.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <section
      className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4 space-y-2"
      data-testid="widget-top-skip-reasons"
    >
      <header className="flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-cyan-400" />
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Top SKIPs (6h)
        </h3>
      </header>
      {reasons.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic" data-testid="empty-top-skip-reasons">
          Sin SKIPs en las últimas 6h. El bot está bien o el classifier está pausado.
        </p>
      ) : (
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li
              key={`${r.reason}-${i}`}
              className="flex items-center gap-2"
              data-testid={`skip-row-${i}`}
            >
              <span className="w-3 text-[10px] font-mono text-slate-600 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-slate-300 truncate" title={r.reason}>
                    {r.reason}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {r.count} · {r.strategyId ?? "—"}
                  </span>
                </div>
                <div className="h-1 bg-[#0a0e1a] rounded overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-cyan-700/60"
                    style={{ width: `${maxCount ? (r.count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function MonitoringSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="monitoring-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg bg-[#151b28] border border-[#1f2937] p-4">
          <div className="h-3 bg-slate-800 rounded w-1/3 animate-pulse mb-3" />
          <div className="h-2 bg-slate-800 rounded w-full animate-pulse mb-1.5" />
          <div className="h-2 bg-slate-800 rounded w-2/3 animate-pulse mb-1.5" />
          <div className="h-2 bg-slate-800 rounded w-3/4 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
