// src/components/terminal/EvidenceReports.client.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toArray, normalizeListResponse, normalizeSingleResponse } from "@/lib/safe";
import { logError } from "@/lib/log";
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

  // Auto-refresh para instruments (60 segundos)
  const {
    data: instrumentsRaw,
    error: instrumentsError,
    missingTable: instrumentsMissingTable,
    refresh: refreshInstruments,
  } = useAutoRefresh<Instrument[]>({
    key: "EvidenceReports:instruments",
    fetcher: async () => {
      const response = await fetch("/api/terminal/instruments");
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: No se pudieron cargar instrumentos`
        );
      }
      const data = await response.json();
      return normalizeListResponse<Instrument>(data);
    },
    intervalMs: 60000,
    enabled: true,
    onError: (err) => {
      logError("EvidenceReports", {
        component: "EvidenceReports",
        action: "fetch instruments",
        endpoint: "/api/terminal/instruments",
        message: err.message,
      });
    },
  });

  const instruments = toArray<Instrument>(instrumentsRaw || []);

  // Auto-refresh para reports (60 segundos)
  const {
    data: reportsRaw,
    isLoading: reportsLoading,
    error: reportsError,
    refresh: refreshReports,
  } = useAutoRefresh<Report[]>({
    key: "EvidenceReports:reports",
    fetcher: async () => {
      const response = await fetch("/api/terminal/evidence");
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: No se pudieron cargar reportes`
        );
      }
      const data = await response.json();
      return normalizeListResponse<Report>(data);
    },
    intervalMs: 60000,
    enabled: true,
    onError: (err) => {
      logError("EvidenceReports", {
        component: "EvidenceReports",
        action: "fetch reports",
        endpoint: "/api/terminal/evidence",
        message: err.message,
      });
    },
  });

  const reports = toArray<Report>(reportsRaw || []);

  const handleGenerateWithAI = async () => {
    if (!formData.title.trim()) {
      setError("Por favor ingresa un título");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/terminal/evidence/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: formData.instrument_id || null,
          title: formData.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.error || `HTTP ${response.status}`;
        setError(msg);
        logError("EvidenceReports", {
          component: "EvidenceReports",
          action: "generate with AI",
          endpoint: "/api/terminal/evidence/generate",
          status: response.status,
          message: msg,
        });
        return;
      }

      const result = normalizeSingleResponse<{
        reportId: string;
        content: string;
      }>(await response.json());

      if (result?.reportId && result?.content) {
        setFormData((prev) => ({
          ...prev,
          content: result.content,
        }));
        setSelectedReportId(result.reportId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      logError("EvidenceReports", {
        component: "EvidenceReports",
        action: "generate with AI",
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
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.error || `HTTP ${response.status}`;
        setError(msg);
        logError("EvidenceReports", {
          component: "EvidenceReports",
          action: "save report",
          endpoint: url,
          status: response.status,
          message: msg,
        });
        return;
      }

      const data = normalizeSingleResponse<Report>(await response.json());
      if (data?.id) {
        setSelectedReportId(data.id);
      }
      resetForm();
      await refreshReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      logError("EvidenceReports", {
        component: "EvidenceReports",
        action: "save report",
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
      const response = await fetch(`/api/terminal/evidence/${reportId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: No se pudo eliminar`);
      }

      if (selectedReportId === reportId) {
        setSelectedReportId(null);
      }
      await refreshReports();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      logError("EvidenceReports", {
        component: "EvidenceReports",
        action: "delete report",
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
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium text-sm"
          >
            {showForm ? "Cancelar" : "+ Nuevo Reporte"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-700 p-4 rounded-lg border border-slate-600 space-y-3"
          >
            {error && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Título (obligatorio)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-600 border border-slate-500 text-white text-sm"
                placeholder="Ej: Análisis de ruptura"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Instrumento (opcional)
              </label>
              <select
                value={formData.instrument_id}
                onChange={(e) =>
                  setFormData({ ...formData, instrument_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded bg-slate-600 border border-slate-500 text-white text-sm"
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
              className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-white font-medium text-sm"
            >
              {generating ? "Generando..." : "🤖 Generar con IA (stub)"}
            </button>
            {formData.content && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Contenido
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  className="w-full px-3 py-2 rounded bg-slate-600 border border-slate-500 text-white text-sm font-mono"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium text-sm"
              >
                {editingReport ? "Actualizar" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white font-medium text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          <p className="text-sm font-medium text-gray-300">Reportes</p>
          {reportsLoading ? (
            <div className="text-gray-400 text-sm">Cargando...</div>
          ) : reports.length === 0 ? (
            <div className="text-gray-400 text-sm">Sin reportes aún</div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`p-3 rounded border cursor-pointer transition text-sm ${
                  selectedReportId === report.id
                    ? "bg-blue-700 border-blue-600"
                    : "bg-slate-700 border-slate-600 hover:border-slate-500"
                }`}
              >
                <p className="font-medium text-white truncate">
                  {report.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
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
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedReport.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(selectedReport.created_at).toLocaleString(
                      "es-ES"
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(selectedReport)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(selectedReport.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <pre className="bg-slate-700 p-4 rounded overflow-x-auto text-sm text-gray-200 whitespace-pre-wrap break-words">
                  {selectedReport.content}
                </pre>
              </div>
            </div>

            {/* Attachments Section */}
            <EvidenceAttachments reportId={selectedReport.id} />
          </>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center text-gray-400">
            Selecciona un reporte para ver detalles
          </div>
        )}
      </div>
    </div>
  );
}
