// src/components/logs/LogsScreen.client.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import FiltersBar from "./FiltersBar.client";
import LogEditor from "./LogEditor.client";
import { showErrorToast, getErrorMessage } from "@/lib/toast";

import { logError, logInfo } from "@/lib/log";
interface Log {
  id: string;
  title: string;
  notes: string;
  type: string | null;
  category_id: string;
  categories: { name: string };
  log_tags?: Array<{ tags: { name: string } }>;
  created_at: string;
}

interface LogsScreenClientProps {
  userEmail: string;
}

export default function LogsScreenClient({ userEmail }: LogsScreenClientProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    query: "",
    categoryId: "",
    type: "",
    trash: false,
  });

  // Editor modal
  const [showEditor, setShowEditor] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | undefined>();

  // Fetch logs
  const fetchLogs = useCallback(
    async (pageNum: number) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          page: pageNum.toString(),
          ...(filters.query && { q: filters.query }),
          ...(filters.categoryId && { categoryId: filters.categoryId }),
          ...(filters.type && { type: filters.type }),
          ...(filters.trash && { trash: "1" }),
        });

        const response = await fetch(`/api/logs?${params}`);
        if (!response.ok) {
          const statusCode = response.status;
          if (statusCode === 401) {
            window.location.href = "/auth";
            return;
          }

          // For other errors, show user-friendly message
          const errorMsg = `Failed to load logs (Error ${statusCode}). Please check your connection and try again.`;
          logError("LogsScreen", { component: "logs.logsScreen.fetch", message: "GET /api/logs returned non-200", status: statusCode });
          setError(errorMsg);
          showErrorToast(errorMsg);
          
          // Set empty result
          setLogs([]);
          setPage(1);
          setTotalPages(0);
          setTotalCount(0);
          return;
        }

        const data = await response.json();
        setLogs(data.items || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 0);
        setTotalCount(data.totalCount || 0);
      } catch (err) {
        const errorMsg = "Network error: Unable to load logs. Please check your connection.";
        logError("LogsScreen", { component: "logsscreen", message: "[LogsScreen] Error fetching logs", error: err instanceof Error ? err.message : String(err) });
        setError(errorMsg);
        showErrorToast(errorMsg);
        
        // Network error - show empty list
        setLogs([]);
        setPage(1);
        setTotalPages(0);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // Load logs on mount and when filters/page change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, filters, fetchLogs]);

  // Handle save log
  const handleSaveLog = async (data: {
    id?: string;
    title: string;
    notes: string;
    categoryId: string;
    type: string;
    tagNames: string[];
  }) => {
    try {
      const url = data.id ? `/api/logs?id=${data.id}` : "/api/logs";
      const method = data.id ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          notes: data.notes,
          categoryId: data.categoryId,
          type: data.type,
          tagNames: data.tagNames,
        }),
      });

      if (response.status === 409) {
        const errorData = await response.json();
        showErrorToast(errorData.message);
        throw new Error(errorData.message);
      }

      if (!response.ok) {
        const errorMsg = `Failed to save log (Error ${response.status})`;
        showErrorToast(errorMsg);
        throw new Error(errorMsg);
      }

      // Success message
      logInfo("LogsScreen", "Log saved successfully", { component: "logsscreen" });
      
      // Reload logs
      setPage(1);
      await fetchLogs(1);
    } catch (err: any) {
      throw err;
    }
  };

  // Handle delete log
  const handleDeleteLog = async (logId: string, permanent: boolean = false) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este log?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/logs?id=${logId}${permanent ? "&permanent=true" : ""}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorMsg = `Failed to delete log (Error ${response.status})`;
        showErrorToast(errorMsg);
        throw new Error(errorMsg);
      }

      logInfo("LogsScreen", "Log deleted successfully", { component: "logsscreen" });
      await fetchLogs(page);
    } catch (err) {
      logError("LogsScreen", { component: "logsscreen", message: "Error deleting log", error: err instanceof Error ? err.message : String(err) });
      const errorMsg = getErrorMessage(err) || "Error al eliminar el log";
      setError(errorMsg);
    }
  };

  // Handle restore log
  const handleRestoreLog = async (logId: string) => {
    try {
      const response = await fetch(`/api/logs?id=${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleted_at: null }),
      });

      if (!response.ok) {
        const errorMsg = `Failed to restore log (Error ${response.status})`;
        showErrorToast(errorMsg);
        throw new Error(errorMsg);
      }

      logInfo("LogsScreen", "Log restored successfully", { component: "logsscreen" });
      await fetchLogs(page);
    } catch (err) {
      logError("LogsScreen", { component: "logsscreen", message: "Error restoring log", error: err instanceof Error ? err.message : String(err) });
      const errorMsg = getErrorMessage(err) || "Error al restaurar el log";
      setError(errorMsg);
    }
  };

  return (
    <div>
      {/* Header with action button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#1f2937",
            margin: 0,
          }}
        >
          {filters.trash ? "Papelera" : "Logs"}
        </h2>
        {!filters.trash && (
          <button
            onClick={() => {
              setEditingLog(undefined);
              setShowEditor(true);
            }}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: "500",
              backgroundColor: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            + Nuevo Log
          </button>
        )}
      </div>

      {/* Filters */}
      <FiltersBar onFiltersChange={setFilters} />

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          Cargando...
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#6b7280",
            backgroundColor: "#f9fafb",
            borderRadius: "6px",
          }}
        >
          <p style={{ fontSize: "15px" }}>
            {filters.trash ? "No hay logs en la papelera" : "No hay logs. ¡Crea uno!"}
          </p>
        </div>
      )}

      {/* Logs list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: "16px",
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                gap: "12px",
              }}
            >
              <div
                style={{ flex: 1 }}
                onClick={() => {
                  setEditingLog(log);
                  setShowEditor(true);
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1f2937",
                    margin: "0 0 6px 0",
                  }}
                >
                  {log.title}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    margin: "0 0 8px 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {log.notes}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#7c3aed" }}>
                    📁 {log.categories?.name || "Sin categoría"}
                  </span>
                  {log.type && (
                    <span style={{ color: "#f59e0b" }}>📌 {log.type}</span>
                  )}
                  {log.log_tags && log.log_tags.length > 0 && (
                    <span style={{ color: "#3b82f6" }}>
                      🏷️ {log.log_tags.map((lt) => lt.tags.name).join(", ")}
                    </span>
                  )}
                  <span style={{ color: "#999" }}>
                    📅 {new Date(log.created_at).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px" }}>
                {!filters.trash && (
                  <>
                    <button
                      onClick={() => {
                        setEditingLog(log);
                        setShowEditor(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Borrar
                    </button>
                  </>
                )}
                {filters.trash && (
                  <>
                    <button
                      onClick={() => handleRestoreLog(log.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#10b981",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id, true)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#6b7280",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              disabled={p === page}
              style={{
                padding: "8px 12px",
                fontSize: "14px",
                backgroundColor: p === page ? "#3b82f6" : "#e5e7eb",
                color: p === page ? "#fff" : "#1f2937",
                border: "none",
                borderRadius: "4px",
                cursor: p === page ? "default" : "pointer",
                fontWeight: p === page ? "600" : "400",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Info */}
      <div
        style={{
          textAlign: "center",
          marginTop: "16px",
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        {totalCount > 0 && (
          <>
            Mostrando {logs.length} de {totalCount} logs
            {totalPages > 1 && ` (página ${page})`}
          </>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <LogEditor
          log={editingLog}
          onSave={handleSaveLog}
          onClose={() => {
            setShowEditor(false);
            setEditingLog(undefined);
          }}
        />
      )}
    </div>
  );
}
