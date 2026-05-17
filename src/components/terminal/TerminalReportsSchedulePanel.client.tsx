"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, CalendarPlus, Trash2 } from "lucide-react";
import { ConfirmDialog, Skeleton, EmptyState } from "@/components/ui";

type Asset = "US500" | "XAUUSD" | "BOTH";

interface ScheduleJob {
  id: string;
  asset: Asset;
  scheduled_for: string;
  status: "pending" | "running" | "success" | "failed";
  qstash_schedule_id: string | null;
  created_at: string;
}

const ASSETS: { value: Asset; label: string }[] = [
  { value: "US500",  label: "US500 (S&P 500)" },
  { value: "XAUUSD", label: "XAUUSD (Oro)" },
  { value: "BOTH",   label: "Ambos activos" },
];

const STATUS_STYLE: Record<ScheduleJob["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  running: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  success: "bg-green-500/15 text-green-300 border-green-500/30",
  failed:  "bg-red-500/15 text-red-300 border-red-500/30",
};

export function TerminalReportsSchedulePanel() {
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [asset, setAsset] = useState<Asset>("XAUUSD");
  const [datetime, setDatetime] = useState("");

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/terminal/reports/schedule", { cache: "no-store" });
      if (!res.ok) {
        toast.error("No se pudieron cargar los jobs");
        return;
      }
      const data = (await res.json()) as ScheduleJob[];
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const handleCreate = async () => {
    if (!datetime) {
      toast.error("Fecha y hora requeridas");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/terminal/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, datetimePR: datetime }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo crear el job");
        return;
      }
      toast.success("Reporte programado");
      setDatetime("");
      await loadJobs();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/terminal/reports/schedule?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("No se pudo cancelar");
        return;
      }
      toast.success("Job cancelado");
      await loadJobs();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setConfirmCancelId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form crear */}
      <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
          <CalendarPlus size={14} className="text-[#22d3ee]" /> Programar reporte
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#475569] mb-1">Activo</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as Asset)}
              disabled={creating}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-[#22d3ee]/50"
            >
              {ASSETS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#475569] mb-1">Fecha y hora (PR)</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              disabled={creating}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-[#22d3ee]/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !datetime}
              className="w-full px-4 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] disabled:opacity-50 text-[#0a0e1a] text-sm font-bold rounded transition-colors"
            >
              {creating ? "Programando…" : "Programar"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#475569] mt-2">
          El cron se ejecuta una vez en la hora indicada (zona Puerto Rico, UTC-4). QStash dispara el endpoint
          <code className="mx-1 text-[#94a3b8]">/api/terminal/reports/run-scheduled</code>.
        </p>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-2">
          <Calendar size={14} /> Jobs programados ({jobs.length})
        </h2>

        {loading ? (
          <Skeleton height={64} count={3} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sin jobs programados"
            message="Programa un reporte arriba para verlo aquí."
          />
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#e2e8f0] font-mono">{job.asset}</span>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5 ${STATUS_STYLE[job.status]}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] mt-1 font-mono">
                    {new Date(job.scheduled_for).toLocaleString()}
                  </p>
                  {job.qstash_schedule_id && (
                    <p className="text-[10px] text-[#475569] mt-0.5 truncate">
                      QStash · {job.qstash_schedule_id}
                    </p>
                  )}
                </div>
                {(job.status === "pending" || job.status === "running") && (
                  <button
                    onClick={() => setConfirmCancelId(job.id)}
                    className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                    aria-label="Cancelar job"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancelId !== null}
        title="Cancelar job"
        message="El reporte programado se eliminará. Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Cancelar job"
        cancelLabel="Mantener"
        onCancel={() => setConfirmCancelId(null)}
        onConfirm={() => (confirmCancelId ? handleCancel(confirmCancelId) : Promise.resolve())}
      />
    </div>
  );
}
