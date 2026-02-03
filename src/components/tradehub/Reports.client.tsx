// src/components/tradehub/Reports.client.tsx
"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/alphashield/logger";

interface Report {
  id: string;
  week_start: string;
  week_end: string;
  content_md: string;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
  created_at: string;
  deleted_at: string | null;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      // Call GET endpoint (will create if doesn't exist)
      const response = await fetch("/api/tradehub/reports");

      if (!response.ok) {
        const statusCode = response.status;
        if (statusCode === 401) {
          window.location.href = "/auth";
          return;
        }
        await logger.error("tradehub", "Fetch reports failed", undefined, {
          endpoint: "/api/tradehub/reports",
          status: statusCode,
        });
        setReports([]);
        return;
      }

      const data = await response.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      await logger.error(
        "tradehub",
        "Fetch reports error",
        err instanceof Error ? err : undefined
      );
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setError("");

      const response = await fetch("/api/tradehub/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error || `HTTP ${response.status}`;
        throw new Error(msg);
      }

      const { existing, report } = await response.json();

      if (existing) {
        setError("Reporte para esta semana ya existe");
      }

      // Add or refresh in list
      setReports((prev) => {
        const filtered = prev.filter((r) => r.id !== report.id);
        return [report, ...filtered];
      });

      setExpandedReportId(report.id);
    } catch (err: any) {
      const message = err?.message || "Error al generar reporte";
      setError("No se pudo generar el reporte. Intenta de nuevo.");
      if (process.env.NODE_ENV !== "production") {
        console.error("[TradeHub] Generate report error", err);
      }
      await logger.error(
        "tradehub",
        "Generate report error",
        err instanceof Error ? err : undefined,
        { feature: "alphabrief", action: "generate", message }
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("¿Eliminar este reporte?")) return;

    try {
      const response = await fetch(`/api/tradehub/reports/${reportId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete report");
      }

      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setExpandedReportId(null);
    } catch (err: any) {
      setError(err.message || "Error al eliminar reporte");
      await logger.error(
        "tradehub",
        "Delete report error",
        err instanceof Error ? err : undefined
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">📊 Reportes Semanales</h2>
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className={`px-6 py-2 rounded font-semibold transition-colors ${
            generating
              ? "bg-blue-700 text-white opacity-50 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {generating ? "Generando..." : "🤖 Generar AlphaBrief"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 p-3 rounded">
          ⚠️ {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-slate-400 text-center py-8">
          Cargando reportes...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-slate-700 rounded-lg p-8 text-center">
          <p className="text-slate-400 mb-4">
            No hay reportes generados aún
          </p>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className={`px-6 py-2 rounded font-semibold transition-colors ${
              generating
                ? "bg-blue-700 text-white opacity-50 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {generating ? "Generando..." : "Generar tu primer AlphaBrief"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-slate-700 rounded-lg overflow-hidden">
              {/* Report Header (Collapsible) */}
              <button
                onClick={() =>
                  setExpandedReportId(
                    expandedReportId === report.id ? null : report.id
                  )
                }
                className="w-full p-4 flex justify-between items-start hover:bg-slate-600 transition-colors text-left"
              >
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">
                    {report.week_start} → {report.week_end}
                  </h3>
                  <div className="text-slate-400 text-sm mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500">Operaciones:</span>{" "}
                      <span className="text-white">{report.total_trades}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Win Rate:</span>{" "}
                      <span className="text-white">
                        {report.win_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">P&L Total:</span>{" "}
                      <span
                        className={
                          report.total_pnl >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        ${report.total_pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Generado:</span>{" "}
                      <span className="text-white">
                        {new Date(report.created_at).toLocaleDateString(
                          "es-ES"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-2xl ml-4">
                  {expandedReportId === report.id ? "▼" : "▶"}
                </span>
              </button>

              {/* Report Content (Expanded) */}
              {expandedReportId === report.id && (
                <div className="border-t border-slate-600 p-4 space-y-3">
                  {/* Markdown Content (rendered as pre-formatted text) */}
                  <div className="bg-slate-800 p-4 rounded text-sm font-mono whitespace-pre-wrap text-slate-200 overflow-x-auto">
                    {report.content_md}
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end mt-4 pt-4 border-t border-slate-600">
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="px-4 py-2 bg-red-900 text-red-100 rounded hover:bg-red-800 transition-colors font-semibold text-sm"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
