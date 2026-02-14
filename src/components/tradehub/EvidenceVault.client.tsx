"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { logger } from "@/lib/alphashield/logger";

interface Account {
  id: string;
  name: string;
}

interface Trade {
  id: string;
  account_id?: string | null;
  symbol: string;
  direction: string;
}

interface Evidence {
  id: string;
  title?: string | null;
  user_notes: string | null;
  image_path?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  validation_status: "needs_review" | "valid" | "invalid";
  trade_id: string | null;
  account_id: string | null;
  captured_at: string;
  created_at: string;
  account?: Account;
  trade?: Trade;
  source?: string;
}

interface EvidenceForm {
  notes: string;
  capturedAt: string;
  file: File | null;
  accountId: string;
  tradeId: string;
}

const INITIAL_FORM: EvidenceForm = {
  notes: "",
  capturedAt: "",
  file: null,
  accountId: "",
  tradeId: "",
};

async function parseApiError(response: Response, fallback: string): Promise<string> {
  const cloned = response.clone();

  try {
    const json = (await response.json()) as {
      error?: string;
      details?: Record<string, string> | string;
    };

    if (json?.details && typeof json.details === "object") {
      const detailText = Object.entries(json.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ");
      return json.error ? `${json.error}. ${detailText}` : detailText;
    }

    if (typeof json?.details === "string" && json.details.trim()) {
      return json.error ? `${json.error}. ${json.details}` : json.details;
    }

    if (json?.error?.trim()) {
      return json.error;
    }
  } catch {
    // fall through to text parsing
  }

  try {
    const text = await cloned.text();
    if (text?.trim()) return text;
  } catch {
    // keep fallback
  }

  return fallback;
}

export default function EvidenceVault() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [formData, setFormData] = useState<EvidenceForm>(INITIAL_FORM);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) return;
      const data: Account[] = await response.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      await logger.error("tradehub", "Error fetching accounts", err instanceof Error ? err : undefined);
    }
  }, []);

  const fetchTrades = useCallback(async () => {
    try {
      const response = await fetch("/api/tradehub/trades?limit=200&offset=0");
      if (!response.ok) return;
      const data: Trade[] = await response.json();
      setTrades(Array.isArray(data) ? data : []);
    } catch (err) {
      await logger.error("tradehub", "Error fetching trades", err instanceof Error ? err : undefined);
    }
  }, []);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/tradehub/evidence");
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/auth";
          return;
        }

        const message = await parseApiError(response, "No se pudo cargar la evidencia");
        setError(message);
        setEvidence([]);
        return;
      }

      const data = await response.json();
      setEvidence(Array.isArray(data) ? data : []);
    } catch (err) {
      await logger.error("tradehub", "Fetch evidence error", err instanceof Error ? err : undefined);
      setError("No se pudo cargar la evidencia");
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
    void fetchTrades();
    void fetchEvidence();
  }, [fetchAccounts, fetchTrades, fetchEvidence]);

  useEffect(() => {
    const selectedId = selectedEvidence?.id;
    const hasFile = Boolean(selectedEvidence?.file_path || selectedEvidence?.image_path);

    if (!selectedId || !hasFile) {
      setPreviewUrl(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;

    const loadSignedUrl = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError("");
        setPreviewUrl(null);

        const response = await fetch(`/api/tradehub/evidence/signed-url?id=${selectedId}`);
        if (!response.ok) {
          const message = await parseApiError(response, "No se pudo cargar la vista previa");
          if (!cancelled) setPreviewError(message);
          return;
        }

        const data = (await response.json()) as { signedUrl?: string };
        if (!cancelled) {
          if (data?.signedUrl) {
            setPreviewUrl(data.signedUrl);
          } else {
            setPreviewError("No se recibio URL firmada para la vista previa");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError("No se pudo cargar la vista previa");
        }
        await logger.error("tradehub", "Evidence preview load failed", err instanceof Error ? err : undefined, {
          evidence_id: selectedId,
        });
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void loadSignedUrl();

    return () => {
      cancelled = true;
    };
  }, [selectedEvidence]);

  const visibleTrades = useMemo(() => {
    if (!formData.accountId) return trades;
    return trades.filter((trade) => trade.account_id === formData.accountId);
  }, [formData.accountId, trades]);

  const isSelectedEvidenceImage = useMemo(() => {
    if (!selectedEvidence) return false;
    if (selectedEvidence.mime_type?.startsWith("image/")) return true;
    const path = selectedEvidence.file_path || selectedEvidence.image_path || "";
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);
  }, [selectedEvidence]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setError("El archivo excede el limite de 100MB");
      return;
    }

    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if ([".exe", ".bat"].includes(ext)) {
      setError(`La extension ${ext} no esta permitida`);
      return;
    }

    setFormData((prev) => ({ ...prev, file }));
    setError("");
  };

  const handleUpload = async () => {
    try {
      if (!formData.file) {
        setError("Debes seleccionar un archivo");
        return;
      }

      if (!formData.capturedAt) {
        setError("La fecha de captura es requerida");
        return;
      }

      setUploading(true);
      setError("");

      const uploadFormData = new FormData();
      uploadFormData.append("notes", formData.notes);
      uploadFormData.append("captured_at", formData.capturedAt);
      uploadFormData.append("file", formData.file);
      uploadFormData.append("account_id", formData.accountId);
      uploadFormData.append("trade_id", formData.tradeId);

      const response = await fetch("/api/tradehub/evidence", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const message = await parseApiError(response, "No se pudo guardar la evidencia");
        throw new Error(message);
      }

      await fetchEvidence();
      setFormData(INITIAL_FORM);
      setShowUploadDialog(false);
    } catch (err) {
      await logger.error("tradehub", "Error uploading evidence", err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : "No se pudo guardar la evidencia");
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (evidenceId: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);
      setError("");

      const response = await fetch(`/api/tradehub/evidence/${evidenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation_status: newStatus }),
      });

      if (!response.ok) {
        const message = await parseApiError(response, "No se pudo actualizar el estado");
        throw new Error(message);
      }

      await fetchEvidence();
      setSelectedEvidence((prev) => (prev ? { ...prev, validation_status: newStatus as Evidence["validation_status"] } : prev));
    } catch (err) {
      await logger.error("tradehub", "Error updating evidence status", err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    try {
      setError("");
      const response = await fetch(`/api/tradehub/evidence/${evidenceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await parseApiError(response, "No se pudo eliminar la evidencia");
        throw new Error(message);
      }

      await fetchEvidence();
      if (selectedEvidence?.id === evidenceId) {
        setSelectedEvidence(null);
      }
      setDeleteConfirm(null);
    } catch (err) {
      await logger.error("tradehub", "Error deleting evidence", err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : "No se pudo eliminar la evidencia");
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Evidence Vault</h2>
        <button
          onClick={() => setShowUploadDialog((prev) => !prev)}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          {showUploadDialog ? "Cancelar" : "+ Subir evidencia"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-700 bg-red-900/20 p-4 text-red-200">{error}</div>
      )}

      {showUploadDialog && (
        <div className="mb-6 rounded-lg border border-slate-600 bg-slate-700/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Subir evidencia</h3>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Fecha de captura *</label>
              <input
                type="datetime-local"
                value={formData.capturedAt}
                onChange={(event) => setFormData((prev) => ({ ...prev, capturedAt: event.target.value }))}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Archivo *</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-slate-300"
              />
              {formData.file && <p className="mt-1 text-xs text-slate-400">{formData.file.name}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Cuenta (opcional)</label>
              <select
                value={formData.accountId}
                onChange={(event) => setFormData((prev) => ({ ...prev, accountId: event.target.value }))}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
              >
                <option value="">Sin cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Trade (opcional)</label>
              <select
                value={formData.tradeId}
                onChange={(event) => setFormData((prev) => ({ ...prev, tradeId: event.target.value }))}
                className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white"
              >
                <option value="">Sin trade</option>
                {visibleTrades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.symbol} - {trade.direction}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Observaciones o contexto"
              rows={4}
              className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white placeholder-slate-400"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-slate-600"
          >
            {uploading ? "Guardando..." : "Crear evidencia"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {loading ? (
            <div className="text-slate-400">Cargando evidencia...</div>
          ) : evidence.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No hay evidencia guardada.</div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {evidence.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedEvidence(item)}
                  className={`w-full rounded border p-3 text-left transition ${
                    selectedEvidence?.id === item.id
                      ? "border-blue-500 bg-blue-700"
                      : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-white">
                    {item.title?.trim() || item.user_notes?.trim() || "Evidencia sin notas"}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-400">
                    {item.validation_status === "needs_review" && "Necesita revision"}
                    {item.validation_status === "valid" && "Valida"}
                    {item.validation_status === "invalid" && "Invalida"}
                  </p>
                  {item.account?.name && <p className="text-xs text-slate-400">Cuenta: {item.account.name}</p>}
                  {item.trade && <p className="text-xs text-slate-400">Trade: {item.trade.symbol}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedEvidence && (
          <div className="rounded-lg border border-slate-600 bg-slate-700/50 p-6 lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold text-white">Detalles</h3>

            <div className="mb-4">
              {previewLoading && (
                <div className="rounded border border-slate-600 p-4 text-sm text-slate-400">Cargando vista previa...</div>
              )}

              {!previewLoading && previewError && (
                <div className="rounded border border-red-700 bg-red-900/20 p-4 text-sm text-red-200">{previewError}</div>
              )}

              {!previewLoading && !previewError && previewUrl && isSelectedEvidenceImage && (
                <Image
                  src={previewUrl}
                  alt="Evidence preview"
                  width={800}
                  height={400}
                  className="h-auto max-h-64 max-w-full rounded border border-slate-500 object-cover"
                  unoptimized
                />
              )}

              {!previewLoading && !previewError && previewUrl && !isSelectedEvidenceImage && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded border border-slate-500 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
                >
                  Abrir archivo adjunto
                </a>
              )}

              {!previewLoading && !previewError && !previewUrl && (
                <div className="rounded border border-slate-600 p-4 text-sm text-slate-400">
                  Sin archivo adjunto para previsualizar.
                </div>
              )}
            </div>

            <div className="mb-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400">Creada</p>
                <p className="text-white">
                  {new Date(selectedEvidence.created_at).toLocaleDateString()} {new Date(selectedEvidence.created_at).toLocaleTimeString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Titulo</p>
                <p className="text-white">{selectedEvidence.title?.trim() || "Sin titulo"}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Notas</p>
                <p className="text-sm text-white">{selectedEvidence.user_notes || "-"}</p>
              </div>

              {selectedEvidence.account && (
                <div>
                  <p className="text-xs text-slate-400">Cuenta</p>
                  <p className="text-white">{selectedEvidence.account.name}</p>
                </div>
              )}

              {selectedEvidence.trade && (
                <div>
                  <p className="text-xs text-slate-400">Trade</p>
                  <p className="text-white">
                    {selectedEvidence.trade.symbol} - {selectedEvidence.trade.direction}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs text-slate-400">Estado de validacion</p>
                <select
                  value={selectedEvidence.validation_status}
                  onChange={(event) => handleStatusChange(selectedEvidence.id, event.target.value)}
                  disabled={updatingStatus}
                  className="w-full rounded border border-slate-500 bg-slate-600 px-3 py-2 text-white disabled:opacity-50"
                >
                  <option value="needs_review">Necesita revision</option>
                  <option value="valid">Valida</option>
                  <option value="invalid">Invalida</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setDeleteConfirm(selectedEvidence.id)}
              className="w-full rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-sm rounded border border-slate-700 bg-slate-800 p-6">
            <p className="mb-4 text-white">Estas seguro de eliminar esta evidencia?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
