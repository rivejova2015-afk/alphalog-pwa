// src/components/tradehub/TradeHubOverviewWidget.client.tsx
"use client";

import { useEffect, useState } from "react";
import type { PerformanceMetrics } from "@/lib/dashboard/queries";

type Status = "loading" | "ok" | "error";

function Skeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-700/40 bg-slate-800/60 h-20" />
      ))}
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "yellow" | "default";
}) {
  const cls =
    color === "green"
      ? "text-emerald-400"
      : color === "red"
      ? "text-red-400"
      : color === "yellow"
      ? "text-yellow-400"
      : "text-slate-100";

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/80 px-4 py-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TradeHubOverviewWidget() {
  const [status, setStatus] = useState<Status>("loading");
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/metrics")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PerformanceMetrics>;
      })
      .then((data) => {
        setMetrics(data);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const hasData = metrics && metrics.totalTrades > 0;

  return (
    <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="display-font text-lg font-semibold text-slate-100">
          Resumen de Performance
        </h3>
        {status === "ok" && hasData && (
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
            {metrics!.totalTrades} trades
          </span>
        )}
      </div>

      {status === "loading" && <Skeleton />}

      {status === "error" && (
        <p className="text-sm text-red-400">No se pudo cargar las métricas.</p>
      )}

      {status === "ok" && !hasData && (
        <p className="text-sm text-slate-400">
          Registra trades cerrados para ver métricas de performance aquí.
        </p>
      )}

      {status === "ok" && hasData && metrics && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile
              label="Win Rate"
              value={metrics.winRate !== null ? `${metrics.winRate.toFixed(1)}%` : "—"}
              sub={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
              color={
                metrics.winRate === null
                  ? "default"
                  : metrics.winRate >= 50
                  ? "green"
                  : "red"
              }
            />
            <MetricTile
              label="Total Trades"
              value={String(metrics.totalTrades)}
              sub="cerrados"
            />
            <MetricTile
              label="Drawdown"
              value={metrics.drawdown !== null ? `${metrics.drawdown.toFixed(1)}%` : "—"}
              sub="peak-to-trough"
              color={
                metrics.drawdown === null || metrics.drawdown === 0
                  ? "default"
                  : metrics.drawdown < 10
                  ? "yellow"
                  : "red"
              }
            />
            <MetricTile
              label="Top Setup"
              value={metrics.topSetup ?? "—"}
              sub="más frecuente"
            />
          </div>

          {(metrics.monthly_total_pct !== null || metrics.all_time_total_pct !== null) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <MetricTile
                label="Retorno Mensual"
                value={
                  metrics.monthly_total_pct !== null
                    ? `${metrics.monthly_total_pct >= 0 ? "+" : ""}${metrics.monthly_total_pct.toFixed(2)}%`
                    : "—"
                }
                color={
                  metrics.monthly_total_pct === null
                    ? "default"
                    : metrics.monthly_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
              <MetricTile
                label="Retorno All Time"
                value={
                  metrics.all_time_total_pct !== null
                    ? `${metrics.all_time_total_pct >= 0 ? "+" : ""}${metrics.all_time_total_pct.toFixed(2)}%`
                    : "—"
                }
                color={
                  metrics.all_time_total_pct === null
                    ? "default"
                    : metrics.all_time_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
