"use client";

import { useState } from "react";

interface CreateSetupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateSetupModal({
  open,
  onClose,
  onCreated,
}: CreateSetupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/tradehub/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Error al crear setup");
      }

      // Reset form
      setName("");
      setDescription("");
      onClose();
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear setup";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 max-w-md w-full mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-50">Crear Nuevo Setup</h2>

        {error && (
          <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-slate-400">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Breakout 15m"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-400">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ej. Setup de breakout en range de 15 minutos..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
