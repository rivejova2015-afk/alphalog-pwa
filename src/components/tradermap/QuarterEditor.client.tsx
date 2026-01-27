// src/components/tradermap/QuarterEditor.client.tsx
"use client";

import { useMemo, useState } from "react";
import { formatMoney, parseMoneyInput } from "./money";

interface GoalQuarter {
  id: string;
  goal_id: string;
  quarter: number;
  start_date: string;
  end_date: string;
  start_balance: number;
  target_balance: number;
  current_balance?: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface QuarterEditorProps {
  quarter: GoalQuarter;
  currency?: string;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onError: (error: string) => void;
}

export default function QuarterEditor({
  quarter,
  currency,
  onSave,
  onCancel,
  onError,
}: QuarterEditorProps) {
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [formData, setFormData] = useState({
    start_date: quarter.start_date,
    end_date: quarter.end_date,
    start_balance: quarter.start_balance.toString(),
    target_balance: quarter.target_balance.toString(),
    current_balance: quarter.current_balance?.toString() ?? "",
  });

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!formData.start_date || !formData.end_date) {
      errors.push("Las fechas son requeridas");
    }

    const startValue = parseMoneyInput(formData.start_balance);
    const targetValue = parseMoneyInput(formData.target_balance);
    const hasCurrentInput = Boolean(formData.current_balance.trim());
    const currentValue = hasCurrentInput
      ? parseMoneyInput(formData.current_balance)
      : null;

    if (startValue === null) {
      errors.push("El monto inicial es requerido");
    } else if (startValue < 0) {
      errors.push("El monto inicial no puede ser negativo");
    }

    if (targetValue === null) {
      errors.push("El monto objetivo es requerido");
    } else if (targetValue < 0) {
      errors.push("El monto objetivo no puede ser negativo");
    }

    if (startValue !== null && targetValue !== null && targetValue <= startValue) {
      errors.push("El monto objetivo debe ser mayor al inicial");
    }

    if (hasCurrentInput && currentValue === null) {
      errors.push("El monto actual es inválido");
    } else if (currentValue !== null && currentValue < 0) {
      errors.push("El monto actual no puede ser negativo");
    }

    return {
      startValue,
      targetValue,
      currentValue,
      errors,
      isReady:
        errors.length === 0 &&
        Boolean(formData.start_date && formData.end_date && startValue !== null && targetValue !== null),
    };
  }, [formData]);

  const missingAmount =
    validation.startValue !== null && validation.targetValue !== null
      ? validation.targetValue - validation.startValue
      : null;
  const progressPercent =
    validation.currentValue !== null && validation.targetValue && validation.targetValue > 0
      ? (validation.currentValue / validation.targetValue) * 100
      : null;

  const handleSave = async () => {
    try {
      if (!validation.isReady) {
        const message = validation.errors[0] || "Revisa los datos antes de aplicar";
        setLocalError(message);
        onError(message);
        return;
      }

      setSaving(true);
      setLocalError("");
      onError("");

      const response = await fetch(`/api/tradermap/quarters/${quarter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_balance: validation.startValue,
          target_balance: validation.targetValue,
          current_balance: validation.currentValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update quarter");
      }

      await onSave();
    } catch (err: any) {
      console.error("Error saving quarter:", err);
      const message = err.message || "Error al guardar trimestre";
      setLocalError(message);
      onError(message);
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
            type="text"
            inputMode="decimal"
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
            type="text"
            inputMode="decimal"
            value={formData.target_balance}
            onChange={(e) => setFormData({ ...formData, target_balance: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Monto actual (opcional)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={formData.current_balance}
            onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        </div>
      </div>

      <div className="space-y-1 text-xs text-slate-400">
        <p>
          Faltan:{" "}
          <span className="text-white font-semibold">
            {missingAmount === null
              ? "--"
              : formatMoney(missingAmount, currency || "USD")}
          </span>
        </p>
        {validation.currentValue !== null && validation.targetValue !== null && (
          <p>
            Progreso real:{" "}
            <span className="text-white font-semibold">
              {formatMoney(validation.currentValue, currency || "USD")}
            </span>{" "}
            / {formatMoney(validation.targetValue, currency || "USD")}{" "}
            {progressPercent !== null && (
              <span className="text-slate-300">({progressPercent.toFixed(1)}%)</span>
            )}
          </p>
        )}
      </div>

      {localError && (
        <div className="text-xs text-red-300 bg-red-900/30 border border-red-700 rounded px-2 py-1">
          {localError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !validation.isReady}
          className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-xs text-white rounded"
        >
          {saving ? "Guardando..." : "Aplicar"}
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
