"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Filter, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

// Mirror of cme_signals shape returned by /api/algorithms/[id]/signals.
interface SignalRow {
  id:                 string;
  algorithm_id:       string;
  cme_account_id:     string;
  contract:           string;
  direction:          "BUY" | "SELL";
  signal_type:        "entry" | "exit";
  quantity:           number;
  stop_loss_ticks:    number | null;
  take_profit_ticks:  number | null;
  status:             "pending" | "executing" | "executed" | "rejected" | "skipped";
  reject_reason:      string | null;
  created_at:         string;
  executed_at:        string | null;
}

interface Props {
  algorithmId: string;
}

const STATUS_FILTERS = [
  { value: "",          label: "Todos" },
  { value: "skipped",   label: "Shadow / skipped" },
  { value: "executed",  label: "Ejecutados" },
  { value: "rejected",  label: "Rechazados" },
] as const;

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)        return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)     return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000)    return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

function statusIcon(status: SignalRow["status"]) {
  switch (status) {
    case "executed":  return <CheckCircle2 size={11} className="text-[#34d399]" />;
    case "skipped":   return <Clock        size={11} className="text-[#94a3b8]" />;
    case "rejected":  return <XCircle      size={11} className="text-[#ef4444]" />;
    case "executing": return <Loader2      size={11} className="text-[#22d3ee] animate-spin" />;
    default:          return <AlertCircle  size={11} className="text-[#475569]" />;
  }
}

export function AlgorithmShadowInbox({ algorithmId }: Props) {
  const [signals, setSignals]   = useState<SignalRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/algorithms/${algorithmId}/signals?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || `HTTP ${res.status}`);
          setSignals([]);
          return;
        }
        setSignals(json.signals ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [algorithmId, statusFilter]);

  // Aggregate stats from the loaded set.
  const stats = useMemo(() => {
    const last7d = signals.filter((s) => Date.now() - new Date(s.created_at).getTime() < 7 * 86_400_000);
    const buy   = last7d.filter((s) => s.direction === "BUY").length;
    const sell  = last7d.filter((s) => s.direction === "SELL").length;
    const skipped  = last7d.filter((s) => s.status === "skipped").length;
    const executed = last7d.filter((s) => s.status === "executed").length;
    const rejected = last7d.filter((s) => s.status === "rejected").length;
    const allShadow = last7d.length > 0 && last7d.every((s) => s.status === "skipped" && s.reject_reason === "shadow_mode");
    return { total7d: last7d.length, buy, sell, skipped, executed, rejected, allShadow };
  }, [signals]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-[#475569]" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                statusFilter === f.value
                  ? "border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]"
                  : "border-[#1f2937] text-[#94a3b8] hover:border-[#475569]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] font-mono text-[#475569]">
          {stats.total7d} en últimos 7d · {stats.buy} BUY · {stats.sell} SELL
        </div>
      </div>

      {/* Hint: when EVERY signal is shadow-skipped, the dispatcher is producing
          decisions but nothing is reaching Tradovate. That's the moment to
          consider flipping DISPATCH_MODE=live. */}
      {stats.allShadow && (
        <div className="rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 p-3">
          <p className="text-[11px] text-[#22d3ee] font-mono">
            ▸ Los últimos {stats.total7d} signals son shadow_mode. Para ejecutar en Tradovate,
            flippeá la env var <code>DISPATCH_MODE=live</code> en el deploy.
          </p>
        </div>
      )}

      {loading && signals.length === 0 && (
        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-6 text-center">
          <Loader2 size={14} className="inline-block animate-spin text-[#475569]" />
          <p className="text-[10px] text-[#475569] mt-2">Cargando signals…</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/5 p-3">
          <p className="text-[11px] text-[#ef4444] font-mono">Error: {error}</p>
        </div>
      )}

      {!loading && !error && signals.length === 0 && (
        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-6 text-center">
          <p className="text-[11px] text-[#475569]">
            Sin signals todavía. El dispatcher escribe acá cada vez que el engine emite un BUY/SELL.
          </p>
        </div>
      )}

      {signals.length > 0 && (
        <div className="border border-[#1f2937] rounded-lg overflow-hidden">
          <table className="w-full text-[10px] font-mono">
            <thead className="text-[#475569] bg-[#151b28]">
              <tr>
                <th className="text-left py-1.5 px-2">Hace</th>
                <th className="text-left py-1.5 px-2">Dir</th>
                <th className="text-left py-1.5 px-2">Contract</th>
                <th className="text-right py-1.5 px-2">Qty</th>
                <th className="text-right py-1.5 px-2">SL/TP</th>
                <th className="text-left py-1.5 px-2">Estado</th>
                <th className="text-left py-1.5 px-2">Razón</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-t border-[#1f2937] hover:bg-[#151b28]/40">
                  <td className="py-1 px-2 text-[#94a3b8]" title={s.created_at}>{fmtRelative(s.created_at)}</td>
                  <td className="py-1 px-2">
                    <span className={s.direction === "BUY" ? "text-[#34d399]" : "text-[#ef4444]"}>
                      {s.direction}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-[#e2e8f0]">{s.contract}</td>
                  <td className="py-1 px-2 text-right text-[#94a3b8]">{s.quantity}</td>
                  <td className="py-1 px-2 text-right text-[#94a3b8]">
                    {s.stop_loss_ticks ?? "—"} / {s.take_profit_ticks ?? "—"}
                  </td>
                  <td className="py-1 px-2">
                    <span className="inline-flex items-center gap-1">
                      {statusIcon(s.status)}
                      <span className="text-[#94a3b8]">{s.status}</span>
                    </span>
                  </td>
                  <td className="py-1 px-2 text-[#475569] truncate max-w-[180px]" title={s.reject_reason ?? ""}>
                    {s.reject_reason ?? ""}
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
