"use client";

import Image from "next/image";
// src/components/tradehub/EvidenceVault.client.tsx

import { useState, useEffect, useCallback } from "react";

interface Account {
  id: string;
  name: string;
}

interface Trade {
  id: string;
  symbol: string;
  direction: string;
}

interface Evidence {
  id: string;
  title: string;
  report_text: string;
  file_path: string | null;
  mime_type: string | null;
  validation_status: "needs_review" | "valid" | "invalid";
  trade_id: string | null;
  account_id: string | null;
  created_at: string;
  account?: Account;
  trade?: Trade;
}

interface EvidenceForm {
  title: string;
  reportText: string;
  file: File | null;
  accountId: string;
  tradeId: string;
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

  const [formData, setFormData] = useState<EvidenceForm>({
    title: "",
    reportText: "",
    file: null,
    accountId: "",
    tradeId: "",
  });

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data: Account[] = await response.json();
        setAccounts(data || []);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  }, []);

  const fetchTrades = useCallback(async () => {
    try {
      const response = await fetch("/api/tradehub/trades");
      if (response.ok) {
        const data: Trade[] = await response.json();
        setTrades(data || []);
      }
    } catch (err) {
      console.error("Error fetching trades:", err);
    }
  }, []);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/tradehub/evidence");
      if (!response.ok) {
        const statusCode = response.status;
        if (statusCode === 401) {
          window.location.href = "/auth";
          return;
        }
        console.error(`[EvidenceVault] GET /api/tradehub/evidence returned ${statusCode}`);
        setEvidence([]);
        return;
      }

      const data = await response.json();
      setEvidence(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("[EvidenceVault] Error fetching evidence:", err);
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchTrades();
    fetchEvidence();
  }, [fetchAccounts, fetchTrades, fetchEvidence]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setError("Archivo exceeds 100MB limit");
      return;
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if ([".exe", ".bat"].includes(ext)) {
      setError(`Extensión ${ext} no permitida`);
      return;
    }

    setFormData({ ...formData, file });
    setError("");
  };

  const handleUpload = async () => {
    try {
      if (!formData.title.trim()) {
        setError("Title es requerido");
        return;
      }

      if (!formData.reportText.trim()) {
        setError("Report text es requerido");
        return;
      }

      setError("");
      setUploading(true);

      const uploadFormData = new FormData();
      uploadFormData.append("title", formData.title);
      uploadFormData.append("report_text", formData.reportText);
      if (formData.file) {
        uploadFormData.append("file", formData.file);
      }
      uploadFormData.append("account_id", formData.accountId);
      uploadFormData.append("trade_id", formData.tradeId);

      const response = await fetch("/api/tradehub/evidence", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await fetchEvidence();
      setFormData({
        title: "",
        reportText: "",
        file: null,
        accountId: "",
        tradeId: "",
      });
      setShowUploadDialog(false);
    } catch (err: any) {
      console.error("Error uploading evidence:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (evidenceId: string, newStatus: string) => {
    try {
      setError("");
      setUpdatingStatus(true);

      const response = await fetch(`/api/tradehub/evidence/${evidenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation_status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      await fetchEvidence();
      setSelectedEvidence(null);
    } catch (err: any) {
      console.error("Error updating status:", err);
      setError("Error al actualizar status");
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
        throw new Error("Failed to delete evidence");
      }

      await fetchEvidence();
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error("Error deleting evidence:", err);
      setError("Error al eliminar evidencia");
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📁 Evidence Vault</h2>
        <button
          onClick={() => setShowUploadDialog(!showUploadDialog)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
        >
          {showUploadDialog ? "Cancelar" : "+ Subir Evidencia"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="mb-6 p-6 bg-slate-700/50 border border-slate-600 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Subir Evidencia</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Evidence title..."
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* File Input (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Archivo (imagen, PDF)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-slate-300"
              />
              {formData.file && (
                <p className="text-xs text-slate-400 mt-1">{formData.file.name}</p>
              )}
            </div>

            {/* Account Link (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cuenta (opcional)
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Sin cuenta</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trade Link (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Trade (opcional)
              </label>
              <select
                value={formData.tradeId}
                onChange={(e) => setFormData({ ...formData, tradeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Sin trade</option>
                {trades.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.symbol} - {trade.direction}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Report Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Report Text *
            </label>
            <textarea
              value={formData.reportText}
              onChange={(e) => setFormData({ ...formData, reportText: e.target.value })}
              placeholder="Detailed report text or notes..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded font-semibold"
          >
            {uploading ? "Cargando..." : "Crear Evidencia"}
          </button>
        </div>
      )}

      {/* Evidence List & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1">
          {loading ? (
            <div className="text-slate-400">Cargando evidencia...</div>
          ) : evidence.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              No hay evidencia. Sube tu primera captura.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {evidence.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvidence(ev)}
                  className={`w-full p-3 text-left rounded border transition ${
                    selectedEvidence?.id === ev.id
                      ? "bg-blue-700 border-blue-500"
                      : "bg-slate-700/50 border-slate-600 hover:bg-slate-700"
                  }`}
                >
                  <p className="text-sm font-semibold text-white truncate">
                    {ev.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-400">
                    {ev.validation_status === "needs_review" && "🔍 Necesita revisión"}
                    {ev.validation_status === "valid" && "✅ Válida"}
                    {ev.validation_status === "invalid" && "❌ Inválida"}
                  </p>
                  {ev.account?.name && (
                    <p className="text-xs text-slate-400">Cuenta: {ev.account.name}</p>
                  )}
                  {ev.trade && (
                    <p className="text-xs text-slate-400">Trade: {ev.trade.symbol}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail View */}
        {selectedEvidence && (
          <div className="lg:col-span-2 bg-slate-700/50 border border-slate-600 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Detalles</h3>

            {/* Image Preview */}
            <div className="mb-4">
              <Image
                src={`/api/tradehub/evidence/${selectedEvidence.id}/signed-url`}
                alt="Evidence preview"
                width={800}
                height={400}
                className="max-w-full h-auto max-h-64 rounded border border-slate-500 object-cover"
                unoptimized
              />
            </div>

            {/* Metadata */}
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs text-slate-400">Creada</p>
                <p className="text-white">
                  {new Date(selectedEvidence.created_at).toLocaleDateString()} {new Date(selectedEvidence.created_at).toLocaleTimeString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Título</p>
                <p className="text-white">{selectedEvidence.title}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Report Text</p>
                <p className="text-white text-sm">{selectedEvidence.report_text}</p>
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
                    {selectedEvidence.trade.symbol} • {selectedEvidence.trade.direction}
                  </p>
                </div>
              )}

              {/* Status Selector */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Estado de Validación</p>
                <select
                  value={selectedEvidence.validation_status}
                  onChange={(e) => handleStatusChange(selectedEvidence.id, e.target.value)}
                  disabled={updatingStatus}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white disabled:opacity-50"
                >
                  <option value="needs_review">🔍 Necesita Revisión</option>
                  <option value="valid">✅ Válida</option>
                  <option value="invalid">❌ Inválida</option>
                </select>
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => setDeleteConfirm(selectedEvidence.id)}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-sm"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded p-6 max-w-sm">
            <p className="text-white mb-4">¿Estás seguro de eliminar esta evidencia?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
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
