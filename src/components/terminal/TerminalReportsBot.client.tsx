"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/alphashield/logger";

import { logWarn } from "@/lib/log";
type Asset = "XAUUSD";

type Job = {
  id: string;
  asset: string;
  scheduled_for: string;
  status: string;
  outcome?: string | null;
  error?: string | null;
};

const ASSET_OPTIONS: { value: Asset; label: string }[] = [
  { value: "XAUUSD", label: "XAUUSD (Gold)" },
];

export default function TerminalReportsBot() {
  const [asset, setAsset] = useState<Asset>("XAUUSD");
  const [scheduleAsset, setScheduleAsset] = useState<Asset>("XAUUSD");
  const [datetimePR, setDatetimePR] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isResettingSw, setIsResettingSw] = useState(false);

  const parseJsonSafe = async (response: Response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const normalizeFetchError = (err: unknown) => {
    if (err instanceof Error) {
      if (err.message?.toLowerCase().includes("failed to fetch")) {
        return "Sin conexión o bloqueo de red. Verifica tu conexión e inténtalo de nuevo.";
      }
      return err.message;
    }
    return "Error inesperado";
  };

  const fetchWithTimeout = async (input: RequestInfo, init?: RequestInit, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleResetPwa = async () => {
    setIsResettingSw(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      logWarn("TerminalReportsBot", "[Terminal] Failed to reset PWA cache", { component: "terminalreportsbot", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsResettingSw(false);
      window.location.reload();
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetchWithTimeout("/api/terminal/reports/schedule", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await parseJsonSafe(response);
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = window.setInterval(fetchJobs, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const response = await fetchWithTimeout("/api/terminal/reports/generate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok || data?.ok === false) {
        await logger.error("terminal_reports", "Failed to generate report", undefined, {
          status: response.status,
          error: data?.error,
        });
        throw new Error(data?.error || `No se pudo generar (${response.status})`);
      }

      const assetResults = Array.isArray(data?.assets) ? data.assets : [];
      if (assetResults.length === 0) {
        setError("No se pudo generar el reporte. Intenta nuevamente.");
        await fetchJobs();
        return;
      }
      const outcomes = assetResults.map(
        (assetResult: { outcome?: string }) => assetResult.outcome
      );
      const onlyNoChanges =
        outcomes.length > 0 &&
        outcomes.every((outcome: string) => outcome === "done_no_changes");
      const anyFailed = outcomes.some((outcome: string) => outcome === "failed");
      const anyDone = outcomes.some((outcome: string) => outcome === "done");
      const anyIncomplete = assetResults.some(
        (assetResult: { incomplete?: boolean }) => assetResult.incomplete
      );

      if (anyFailed && !anyDone && !onlyNoChanges) {
        setError("No se pudo generar el reporte. Intenta nuevamente.");
      } else if (onlyNoChanges) {
        setMessage("No hay cambios relevantes. No se guardo nueva evidencia.");
      } else if (anyIncomplete) {
        setMessage("Informe incompleto. Reintenta en unos minutos.");
      } else if (anyFailed) {
        setMessage("Reporte generado con advertencias. Revisa Evidence.");
      } else {
        setMessage("Reporte generado. Revisa Evidence.");
      }

      if (anyDone) {
        window.dispatchEvent(new CustomEvent("terminal:reports:refresh"));
      }

      await fetchJobs();
    } catch (err) {
      const message = normalizeFetchError(err);
      await logger.error("terminal_reports", "Generate report error", err instanceof Error ? err : undefined, {
        message,
      });
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
      const tempId = `temp-${Date.now()}`;
      const scheduledDate = new Date(datetimePR);
      const tempJob: Job = {
        id: tempId,
        asset: scheduleAsset,
        scheduled_for: Number.isNaN(scheduledDate.getTime())
          ? new Date().toISOString()
          : scheduledDate.toISOString(),
        status: "pending",
      };
      setJobs((prev) => [tempJob, ...prev]);

      const response = await fetchWithTimeout("/api/terminal/reports/schedule", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: scheduleAsset, datetimePR, lookback: 7 }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok || data?.ok === false) {
        const details = data?.details?.body ? ` - ${data.details.body}` : "";
        const status = data?.details?.status ? ` (${data.details.status})` : "";
        await logger.error("terminal_reports", "Failed to schedule report", undefined, {
          status: data?.details?.status || response.status,
          body: data?.details?.body,
        });
        setError(`${data?.error || "No se pudo agendar"}${status}${details}`);
        await fetchJobs();
        return;
      }
      if (data?.job) {
        setJobs((prev) => prev.map((job) => (job.id === tempId ? (data.job as Job) : job)));
      }
      setMessage("Reporte agendado correctamente.");
      setDatetimePR("");
      await fetchJobs();
    } catch (err) {
      const message = normalizeFetchError(err);
      await logger.error("terminal_reports", "Schedule report error", err instanceof Error ? err : undefined, {
        message,
      });
      setError(message);
      await fetchJobs();
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetchWithTimeout(`/api/terminal/reports/schedule?id=${id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        await logger.error("terminal_reports", "Failed to cancel schedule", undefined, {
          status: response.status,
          error: data?.error,
        });
        throw new Error(data?.error || `No se pudo cancelar (${response.status})`);
      }
      await fetchJobs();
    } catch (err) {
      const message = normalizeFetchError(err);
      await logger.error("terminal_reports", "Cancel schedule error", err instanceof Error ? err : undefined, {
        message,
      });
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
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm space-y-2">
          <p>{error}</p>
          {error.toLowerCase().includes("sin conexión") && (
            <button
              onClick={handleResetPwa}
              disabled={isResettingSw}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 disabled:bg-slate-700"
            >
              {isResettingSw ? "Restableciendo..." : "Restablecer caché PWA"}
            </button>
          )}
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
                {job.error && (
                  <p className="text-xs text-rose-300 mt-2">
                    {job.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
