"use client";

// Lista las cme_signals dispatcheadas en las últimas 7 días por cuenta.
// Útil para validar el comportamiento del cron tradovate-poll mientras
// DISPATCH_MODE='shadow' (antes de pasar a live) y para detectar señales
// rejected por el kill-switch (checkOrderRisk).

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

interface CmeSignalRow {
  id: string;
  algorithm_id: string | null;
  contract: string;
  direction: "BUY" | "SELL";
  quantity: number;
  stop_loss_ticks: number;
  take_profit_ticks: number;
  status: "pending" | "executed" | "skipped" | "rejected";
  reject_reason: string | null;
  signal_type: string;
  executed_at: string | null;
  created_at: string;
}

interface SignalsResponse {
  data: CmeSignalRow[];
  count: number | null;
  tally: Record<string, number>;
}

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "skipped", label: "Shadow" },
  { key: "rejected", label: "Rechazadas" },
  { key: "executed", label: "Ejecutadas" },
  { key: "pending", label: "Pendientes" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function statusIcon(status: CmeSignalRow["status"]) {
  switch (status) {
    case "executed":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case "skipped":
      return <Clock className="w-3.5 h-3.5 text-blue-400" />;
    case "rejected":
      return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    case "pending":
      return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
  }
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default function CmeShadowSignalsPanel({ cmeAccountId }: { cmeAccountId: string }) {
  const [signals, setSignals] = useState<CmeSignalRow[]>([]);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cmeAccountId, sinceHours: "168", limit: "100" });
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/cme/signals?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SignalsResponse;
      setSignals(body.data ?? []);
      setTally(body.tally ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [cmeAccountId, filter]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === "all"
            ? Object.values(tally).reduce((a, b) => a + b, 0)
            : (tally[f.key] ?? 0);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                "px-2.5 py-1 rounded-md text-xs border transition " +
                (active
                  ? "bg-white/10 border-white/30 text-white"
                  : "bg-transparent border-white/10 text-white/50 hover:border-white/20 hover:text-white/70")
              }
            >
              {f.label} <span className="ml-1 text-white/40">({count})</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={fetchSignals}
          disabled={loading}
          className="ml-auto px-2.5 py-1 rounded-md text-xs border border-white/10 text-white/50 hover:text-white/80"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}

      {!loading && signals.length === 0 && !error && (
        <div className="px-3 py-6 rounded-md text-center text-xs text-white/40 border border-white/10 bg-white/[0.02]">
          Sin señales en las últimas 7 días para este filtro.
        </div>
      )}

      {signals.length > 0 && (
        <div className="rounded-md border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.03] text-white/40 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Hora</th>
                <th className="text-left px-3 py-2 font-medium">Dir</th>
                <th className="text-left px-3 py-2 font-medium">Contrato</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">SL/TP</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Razón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {signals.map((s) => (
                <tr key={s.id} className="text-white/70 hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-white/50">{fmtAgo(s.created_at)}</td>
                  <td className="px-3 py-1.5">
                    {s.direction === "BUY" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <TrendingUp className="w-3 h-3" />BUY
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <TrendingDown className="w-3 h-3" />SELL
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{s.contract}</td>
                  <td className="px-3 py-1.5 text-right">{s.quantity}</td>
                  <td className="px-3 py-1.5 text-right text-white/50">
                    {s.stop_loss_ticks}/{s.take_profit_ticks}t
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      {statusIcon(s.status)}
                      <span className="capitalize">{s.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-white/50 max-w-[180px] truncate" title={s.reject_reason ?? ""}>
                    {s.reject_reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
