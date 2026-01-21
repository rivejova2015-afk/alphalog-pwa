// src/components/tradermap/QuarterEditor.client.tsx
"use client";

import { useState } from "react";

interface GoalQuarter {
  id: string;
  goal_id: string;
  quarter: number;
  start_date: string;
  end_date: string;
  start_balance: number;
  target_balance: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface QuarterEditorProps {
  quarter: GoalQuarter;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onError: (error: string) => void;
}

export default function QuarterEditor({
  quarter,
  onSave,
  onCancel,
  onError,
}: QuarterEditorProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    start_date: quarter.start_date,
    end_date: quarter.end_date,
    start_balance: quarter.start_balance.toString(),
    target_balance: quarter.target_balance.toString(),
  });

  const handleSave = async () => {
    try {
      if (!formData.start_date || !formData.end_date) {
        onError("Las fechas son requeridas");
        return;
      }

      if (!formData.start_balance || !formData.target_balance) {
        onError("Los balances son requeridos");
        return;
      }

      setSaving(true);
      onError("");

      const response = await fetch(`/api/tradermap/quarters/${quarter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_balance: parseFloat(formData.start_balance),
          target_balance: parseFloat(formData.target_balance),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update quarter");
      }

      await onSave();
    } catch (err: any) {
      console.error("Error saving quarter:", err);
      onError(err.message || "Error al guardar trimestre");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-600 rounded p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Start Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Fecha Inicio
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Fecha Fin
          </label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>

        {/* Start Balance */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Balance Inicial
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.start_balance}
            onChange={(e) => setFormData({ ...formData, start_balance: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>

        {/* Target Balance */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Balance Meta
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.target_balance}
            onChange={(e) => setFormData({ ...formData, target_balance: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-xs text-white rounded"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-xs text-slate-300 rounded"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
