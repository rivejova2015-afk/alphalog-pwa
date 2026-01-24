"use client";

import { useState } from "react";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  category_id: string;
  account_size: number | null;
  current_balance: number | null;
  operation_state: string | null;
  phase_status: string | null;
  role: string | null;
  withdrawals_enabled: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface AccountDialogProps {
  account?: Account;
  categories: Category[];
  onSave: (data: Partial<Account>) => Promise<void>;
  onClose: () => void;
}

export default function AccountDialog({
  account,
  categories,
  onSave,
  onClose,
}: AccountDialogProps) {
  const [name, setName] = useState(account?.name || "");
  const [categoryId, setCategoryId] = useState(account?.category_id || "");
  const [accountSize, setAccountSize] = useState(
    account?.account_size?.toString() || ""
  );
  const [currentBalance, setCurrentBalance] = useState(
    account?.current_balance?.toString() || ""
  );
  const [operationState, setOperationState] = useState(
    account?.operation_state || ""
  );
  const [phaseStatus, setPhaseStatus] = useState(account?.phase_status || "");
  const [role, setRole] = useState(account?.role || "");
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(
    account?.withdrawals_enabled ?? true
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (!categoryId) {
      setError("Debes seleccionar una categoría. Si no hay ninguna, créala en Categorías");
      return;
    }

    try {
      setLoading(true);
      await onSave({
        ...(account && { id: account.id }),
        name: name.trim(),
        category_id: categoryId,
        account_size: accountSize ? parseFloat(accountSize) : null,
        current_balance: currentBalance ? parseFloat(currentBalance) : null,
        operation_state: operationState || null,
        phase_status: phaseStatus || null,
        role: role || null,
        withdrawals_enabled: withdrawalsEnabled,
      });
    } catch (err: any) {
      console.error("Error saving account:", err);
      setError(err?.message || "Error al guardar cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-slate-900 border border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-50 mb-4">
          {account ? "Editar Cuenta" : "Nueva Cuenta"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Categorías vacías: mostrar CTA */}
          {!account && categories.length === 0 && (
            <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
              <p className="text-sm text-blue-300 mb-2">
                No hay categorías disponibles. Crea una para continuar.
              </p>
              <Link
                href="/dashboard/tradehub/categories"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium underline"
              >
                → Ir a Categorías
              </Link>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Ej: Forex EURUSD"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Categoría - OBLIGATORIA */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Categoría * {!categoryId && <span className="text-red-400">(requerida)</span>}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loading || categories.length === 0}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">-- Selecciona una categoría --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                Crea una categoría primero en la sección de Categorías
              </p>
            )}
          </div>

          {/* Tamaño */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tamaño de Cuenta
            </label>
            <input
              type="number"
              step="0.01"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              disabled={loading}
              placeholder="Ej: 10000"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Balance Actual */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Balance Actual
            </label>
            <input
              type="number"
              step="0.01"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              disabled={loading}
              placeholder="Ej: 9500"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Estado Operacional */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Estado Operacional
            </label>
            <input
              type="text"
              value={operationState}
              onChange={(e) => setOperationState(e.target.value)}
              disabled={loading}
              placeholder="Ej: Active, Paused, Closed"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Estado de Fase */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Estado de Fase (Propfirm)
            </label>
            <input
              type="text"
              value={phaseStatus}
              onChange={(e) => setPhaseStatus(e.target.value)}
              disabled={loading}
              placeholder="Ej: Phase 1, Phase 2, Passed, Failed"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Rol
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              placeholder="Ej: Demo, Real, Propfirm"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Retiros */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={withdrawalsEnabled}
              onChange={(e) => setWithdrawalsEnabled(e.target.checked)}
              disabled={loading}
              className="cursor-pointer"
            />
            <span className="text-sm text-slate-300">Retiros habilitados</span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || categories.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Guardando..." : account ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
