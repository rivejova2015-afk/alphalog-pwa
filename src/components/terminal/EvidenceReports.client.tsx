// src/components/terminal/EvidenceReports.client.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toArray, normalizeListResponse, normalizeSingleResponse } from "@/lib/safe";
import { logger } from "@/lib/alphashield/logger";
import EvidenceAttachments from "./EvidenceAttachments.client";

interface Instrument {
  id: string;
  symbol: string;
  display_name: string;
}

interface Report {
  id: string;
  title: string;
  content: string;
  instrument_id?: string;
  created_at: string;
}

export default function EvidenceReports() {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    instrument_id: "",
  });
  const [error, setError] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");

  const parseJsonSafe = async (response: Response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
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

  // Auto-refresh para instruments (60 segundos)
  const {
    data: instrumentsRaw,
    error: instrumentsError,
    missingTable: instrumentsMissingTable,
    refresh: refreshInstruments,
  } = useAutoRefresh<Instrument[]>({
    key: "EvidenceReports:instruments",
    fetcher: async () => {
      const response = await fetchWithTimeout("/api/terminal/instruments", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: No se pudieron cargar instrumentos`
        );
      }
      const data = await parseJsonSafe(response);
      return normalizeListResponse<Instrument>(data);
    },
    intervalMs: 60000,
    enabled: true,
    onError: (err) => {
      logger.error("terminal_evidence", "Fetch instruments failed", err, {
        component: "EvidenceReports",
        endpoint: "/api/terminal/instruments",
      });
    },
  });

  const instruments = toArray<Instrument>(instrumentsRaw || []);
  const instrumentMap = useMemo(
    () =>
      new Map(
        instruments.map((instrument) => [instrument.id, instrument.display_name])
      ),
    [instruments]
  );

  // Auto-refresh para reports (60 segundos)
  const {
    data: reportsRaw,
    isLoading: reportsLoading,
    error: reportsError,
    refresh: refreshReports,
  } = useAutoRefresh<Report[]>({
    key: "EvidenceReports:reports",
    fetcher: async () => {
      const response = await fetchWithTimeout("/api/terminal/evidence", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: No se pudieron cargar reportes`
        );
      }
      const data = await parseJsonSafe(response);
      return normalizeListResponse<Report>(data);
    },
    intervalMs: 60000,
    enabled: true,
    onError: (err) => {
      logger.error("terminal_evidence", "Fetch reports failed", err, {
        component: "EvidenceReports",
        endpoint: "/api/terminal/evidence",
      });
    },
  });

  const reports = toArray<Report>(reportsRaw || []);

  useEffect(() => {
    const handler = () => {
      refreshReports();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("terminal:reports:refresh", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("terminal:reports:refresh", handler as EventListener);
      }
    };
  }, [refreshReports]);

  const handleGenerateWithAI = async () => {
    if (!formData.title.trim()) {
      setError("Por favor ingresa un título");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusMessage("");
    setStatusTone("info");

    try {
      const response = await fetchWithTimeout("/api/terminal/evidence/generate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: formData.instrument_id || null,
          title: formData.title,
        }),
      });

      const data = await parseJsonSafe(response);
      if (!response.ok || data?.ok === false) {
        const msg = data?.error || `HTTP ${response.status}`;
        setError(msg);
        await logger.error("terminal_evidence", "Generate with AI failed", undefined, {
          component: "EvidenceReports",
          endpoint: "/api/terminal/evidence/generate",
          status: response.status,
          message: msg,
        });
        return;
      }

      const reportId = data?.reportId as string | undefined;
      const content = typeof data?.content === "string" ? data.content : "";

      if (reportId && content) {
        setFormData((prev) => ({
          ...prev,
          content,
        }));
        setSelectedReportId(reportId);
        await refreshReports();
      } else {
        setError("No se pudo generar el reporte.");
      }

      const incomplete = data?.status === "incomplete" || data?.incomplete === true;
      if (incomplete) {
        setStatusTone("warn");
        setStatusMessage("Informe incompleto. Reintenta en unos minutos.");
      } else {
        setStatusTone("info");
        setStatusMessage("Reporte generado.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      await logger.error("terminal_evidence", "Generate with AI error", err instanceof Error ? err : undefined, {
        component: "EvidenceReports",
        endpoint: "/api/terminal/evidence/generate",
        message: msg,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setError("Por favor completa los campos obligatorios");
      return;
    }
    setStatusMessage("");

    const payload = {
      title: formData.title,
      content: formData.content,
      instrument_id: formData.instrument_id || null,
    };

    try {
      const method = editingReport ? "PATCH" : "POST";
      const url = editingReport
        ? `/api/terminal/evidence/${editingReport.id}`
        : "/api/terminal/evidence";
      const response = await fetchWithTimeout(url, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe(response);
        const msg = errorData?.error || `HTTP ${response.status}`;
        setError(msg);
        await logger.error("terminal_evidence", "Save report failed", undefined, {
          component: "EvidenceReports",
          endpoint: url,
          status: response.status,
          message: msg,
        });
        return;
      }

      const data = normalizeSingleResponse<Report>(await parseJsonSafe(response));
      if (data?.id) {
        setSelectedReportId(data.id);
      }
      resetForm();
      await refreshReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      await logger.error("terminal_evidence", "Save report error", err instanceof Error ? err : undefined, {
        component: "EvidenceReports",
        message: msg,
      });
    }
  };

  const handleEdit = (report: Report) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      content: report.content,
      instrument_id: report.instrument_id || "",
    });
    setSelectedReportId(report.id);
    setShowForm(true);
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("¿Estás seguro de eliminar este reporte?")) {
      return;
    }

    try {
      const response = await fetchWithTimeout(`/api/terminal/evidence/${reportId}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        await logger.error("terminal_evidence", "Delete report failed", undefined, {
          endpoint: `/api/terminal/evidence/${reportId}`,
          status: response.status,
        });
        throw new Error(`HTTP ${response.status}: No se pudo eliminar`);
      }

      if (selectedReportId === reportId) {
        setSelectedReportId(null);
      }
      await refreshReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      await logger.error("terminal_evidence", "Delete report error", err instanceof Error ? err : undefined, {
        component: "EvidenceReports",
        endpoint: `/api/terminal/evidence/${reportId}`,
        message: msg,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      instrument_id: "",
    });
    setEditingReport(null);
    setShowForm(false);
    setError("");
    setStatusMessage("");
  };

  // FIJA: Usa toArray para garantizar que reports siempre es array
  // Nunca llamar .find directamente sin validar
  const selectedReport = toArray<Report>(reports).find(
    (r) => r.id === selectedReportId
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Missing Table Alert */}
      {instrumentsMissingTable && (
        <div className="lg:col-span-3 p-4 bg-amber-900/50 border border-amber-700 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-amber-200">
                ⚠️ Configuración incompleta
              </h3>
              <p className="text-sm text-amber-300 mt-1">
                Falta crear la tabla de instrumentos en la base de datos
                (public.instruments). Por favor, ejecuta las migraciones de
                Supabase.
              </p>
            </div>
            <button
              onClick={refreshInstruments}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded text-sm font-medium whitespace-nowrap ml-4"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* List + Form */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-slate-950 font-medium text-sm shadow-[0_10px_22px_rgba(2,4,10,0.35)] transition"
          >
            {showForm ? "Cancelar" : "+ Nuevo Reporte"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/70 p-4 rounded-2xl border border-slate-700/60 space-y-3 shadow-[0_18px_36px_rgba(2,4,10,0.4)]"
          >
            {error && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                {error}
              </div>
            )}
            {statusMessage && (
              <div
                className={`p-2 rounded text-sm ${
                  statusTone === "warn"
                    ? "bg-amber-900/50 border border-amber-700 text-amber-200"
                    : "bg-emerald-900/40 border border-emerald-700 text-emerald-100"
                }`}
              >
                {statusMessage}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Título (obligatorio)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                placeholder="Ej: Análisis de ruptura"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Instrumento (opcional)
              </label>
              <select
                value={formData.instrument_id}
                onChange={(e) =>
                  setFormData({ ...formData, instrument_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              >
                <option value="">Sin instrumento específico</option>
                {instruments.length === 0 ? (
                  <option disabled>Cargando instrumentos...</option>
                ) : (
                  instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.display_name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={generating}
              className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 rounded-full text-slate-50 font-medium text-sm transition"
            >
              {generating ? "Generando..." : "🤖 Generar con IA"}
            </button>
            {formData.content && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Contenido
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  className="w-full px-3 py-2 rounded bg-slate-950/60 border border-slate-700/60 text-slate-100 text-sm font-mono placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-full text-slate-50 font-medium text-sm transition"
              >
                {editingReport ? "Actualizar" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-3 py-2 rounded-full bg-slate-800/80 text-slate-200 font-medium text-sm transition hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          <p className="text-sm font-medium text-slate-300">Reportes</p>
          {reportsLoading ? (
            <div className="text-slate-400 text-sm">Cargando...</div>
          ) : reports.length === 0 ? (
            <div className="text-slate-400 text-sm">Sin reportes aún</div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`p-3 rounded-2xl border cursor-pointer transition text-sm ${
                  selectedReportId === report.id
                    ? "bg-slate-800/90 border-blue-600/60 shadow-[0_10px_22px_rgba(2,4,10,0.35)]"
                    : "bg-slate-900/70 border-slate-700/60 hover:border-slate-600"
                }`}
              >
                <p className="font-medium text-white truncate">
                  {report.title}
                </p>
                {report.instrument_id && (
                  <p className="text-xs text-slate-400 mt-1">
                    {instrumentMap.get(report.instrument_id) || "Instrumento"}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(report.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="lg:col-span-2 space-y-4">
        {selectedReport ? (
          <>
            <div className="bg-slate-900/70 rounded-3xl border border-slate-700/60 p-6 space-y-4 shadow-[0_18px_40px_rgba(2,4,10,0.45)]">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedReport.title}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {new Date(selectedReport.created_at).toLocaleString(
                      "es-ES"
                    )}
                  </p>
                  {selectedReport.instrument_id && (
                    <p className="text-xs text-slate-400 mt-1">
                      {instrumentMap.get(selectedReport.instrument_id) ||
                        "Instrumento"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(selectedReport)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-full text-slate-950 text-sm font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(selectedReport.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-full text-white text-sm font-medium"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <pre className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 text-sm text-slate-200 whitespace-pre-wrap break-words">
                  {selectedReport.content}
                </pre>
              </div>
            </div>

            {/* Attachments Section */}
            <EvidenceAttachments reportId={selectedReport.id} />
          </>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center text-slate-400">
            Selecciona un reporte para ver detalles
          </div>
        )}
      </div>
    </div>
  );
}
