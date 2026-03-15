// src/components/dashboard/DashboardPerformancePanel.tsx
"use client";

import React from "react";
import type { PerformanceMetrics } from "@/lib/dashboard/queries";

interface Props {
  metrics: PerformanceMetrics;
}

function MetricCard({
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
  const colorClass =
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
      <p className={`text-2xl font-semibold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function pct(n: number | null) {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function DashboardPerformancePanel({ metrics }: Props) {
  const {
    winRate,
    drawdown,
    topSetup,
    totalTrades,
    winningTrades,
    losingTrades,
    daily_total_pct,
    weekly_total_pct,
    monthly_total_pct,
    all_time_total_pct,
  } = metrics;

  const winRateColor =
    winRate === null ? "default" : winRate >= 50 ? "green" : "red";
  const drawdownColor =
    drawdown === null || drawdown === 0
      ? "default"
      : drawdown < 10
      ? "yellow"
      : "red";

  const hasData = totalTrades > 0;

  return (
    <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur animate-fade-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="display-font text-xl font-semibold text-slate-50">
          Performance
        </h2>
        {!hasData && (
          <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
            Sin trades cerrados
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400">
          Registra trades cerrados para ver métricas de performance.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Win Rate"
              value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
              sub={`${winningTrades}W / ${losingTrades}L`}
              color={winRateColor}
            />
            <MetricCard
              label="Total Trades"
              value={String(totalTrades)}
              sub="trades cerrados"
            />
            <MetricCard
              label="Drawdown"
              value={drawdown !== null ? `${drawdown.toFixed(1)}%` : "—"}
              sub="peak-to-trough"
              color={drawdownColor}
            />
            <MetricCard
              label="Top Setup"
              value={topSetup ?? "—"}
              sub="por frecuencia"
            />
          </div>

          {/* Returns by period */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Retornos por período
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                label="Diario"
                value={pct(daily_total_pct)}
                color={
                  daily_total_pct === null
                    ? "default"
                    : daily_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
              <MetricCard
                label="Semanal"
                value={pct(weekly_total_pct)}
                color={
                  weekly_total_pct === null
                    ? "default"
                    : weekly_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
              <MetricCard
                label="Mensual"
                value={pct(monthly_total_pct)}
                color={
                  monthly_total_pct === null
                    ? "default"
                    : monthly_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
              <MetricCard
                label="All Time"
                value={pct(all_time_total_pct)}
                color={
                  all_time_total_pct === null
                    ? "default"
                    : all_time_total_pct >= 0
                    ? "green"
                    : "red"
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
