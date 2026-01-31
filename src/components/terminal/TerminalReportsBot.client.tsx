"use client";

import { useEffect, useState } from "react";

type Asset = "US500" | "XAUUSD" | "BOTH";

type Job = {
  id: string;
  asset: Asset;
  scheduled_for: string;
  status: string;
  outcome?: string | null;
  error?: string | null;
};

const ASSET_OPTIONS: { value: Asset; label: string }[] = [
  { value: "US500", label: "US500 (S&P500)" },
  { value: "XAUUSD", label: "XAUUSD (Gold)" },
  { value: "BOTH", label: "Ambos" },
];

export default function TerminalReportsBot() {
  const [asset, setAsset] = useState<Asset>("US500");
  const [scheduleAsset, setScheduleAsset] = useState<Asset>("US500");
  const [datetimePR, setDatetimePR] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/terminal/reports/schedule");
      if (!response.ok) return;
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const response = await fetch("/api/terminal/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo generar");
      }
      const outcomes = Array.isArray(data?.assets)
        ? data.assets.map((assetResult: { outcome?: string }) => assetResult.outcome)
        : [];
      const onlyNoChanges =
        outcomes.length > 0 && outcomes.every((outcome: string) => outcome === "done_no_changes");
      setMessage(
        onlyNoChanges
          ? "No hay cambios relevantes. No se guardó nueva evidencia."
          : "Reporte generado. Revisa Evidence."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al generar reporte";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!datetimePR) {
      setError("Selecciona fecha y hora (PR)");
      return;
    }
    try {
      setScheduling(true);
      setError("");
      setMessage("");
      const response = await fetch("/api/terminal/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: scheduleAsset, datetimePR, lookback: 7 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo agendar");
      }
      setMessage("Reporte agendado correctamente.");
      setDatetimePR("");
      await fetchJobs();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al agendar reporte";
      setError(message);
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/terminal/reports/schedule?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo cancelar");
      }
      await fetchJobs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cancelar";
      setError(message);
    }
  };

  return (
    <section className="bg-slate-900/70 border border-slate-700/60 rounded-3xl p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Terminal News Bot</h2>
        <p className="text-sm text-slate-400">
          Reportes profesionales (7 días) en horario Puerto Rico (UTC-4).
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3 bg-emerald-900/40 border border-emerald-700 rounded text-emerald-100 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Activo
          </label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as Asset)}
            className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm"
          >
            {ASSET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded-full text-slate-50 font-medium text-sm transition"
          >
            {loading ? "Generando..." : "Generar ahora"}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-700/60 pt-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">
          Programar reporte (una sola vez)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Fecha y hora (America/Puerto_Rico)
            </label>
            <input
              type="datetime-local"
              value={datetimePR}
              onChange={(e) => setDatetimePR(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Activo
            </label>
            <select
              value={scheduleAsset}
              onChange={(e) => setScheduleAsset(e.target.value as Asset)}
              className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm"
            >
              {ASSET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSchedule}
            disabled={scheduling}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-full text-slate-50 font-medium text-sm transition"
          >
            {scheduling ? "Agendando..." : "Agendar"}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-700/60 pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Programados</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400">No hay reportes programados.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-slate-950/50 border border-slate-700/60 rounded-2xl px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-slate-100 font-medium">
                    {job.asset}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {new Date(job.scheduled_for).toLocaleString("es-PR", {
                      timeZone: "America/Puerto_Rico",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-800/80 text-slate-300">
                    {job.status}
                  </span>
                  {job.status === "pending" && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="text-xs px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
