// src/components/tradehub/AccountDialog.client.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import AccountCategorySelect from "./AccountCategorySelect.client";

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
  const [showSeedButton, setShowSeedButton] = useState(!account);

  useEffect(() => {
    // Show seed button only if no categories and creating new
    if (!account && categories.length === 0) {
      setShowSeedButton(true);
    } else {
      setShowSeedButton(false);
    }
  }, [account, categories]);

  const handleSeedCategories = async () => {
    try {
      setLoading(true);
      const supabase = await createClient();

      const defaultCategories = [
        "Propfirm Forex",
        "Propfirm Futuros",
        "Forex Real",
        "Futuros Real",
        "Opciones",
      ];

      for (const catName of defaultCategories) {
        await fetch("/api/account-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catName }),
        });
      }

      // Refetch categories (parent component will do this)
      window.location.reload(); // Simple refresh
    } catch (err: any) {
      console.error("Error seeding categories:", err);
      setError("Error al crear categorías");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !categoryId) {
      setError("Por favor completa los campos obligatorios");
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
      setError("Error al guardar cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#1f2937",
            margin: "0 0 16px 0",
          }}
        >
          {account ? "Editar Cuenta" : "Nueva Cuenta"}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Ej: Forex EURUSD"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Categoría */}
          <AccountCategorySelect
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            showSeedButton={showSeedButton && categories.length === 0}
            onSeedSuccess={() => window.location.reload()}
          />

          {/* Tamaño */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Tamaño de Cuenta
            </label>
            <input
              type="number"
              step="0.01"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              disabled={loading}
              placeholder="Ej: 10000"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Balance Actual */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Balance Actual
            </label>
            <input
              type="number"
              step="0.01"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              disabled={loading}
              placeholder="Ej: 9500"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Estado Operacional */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Estado Operacional
            </label>
            <input
              type="text"
              value={operationState}
              onChange={(e) => setOperationState(e.target.value)}
              disabled={loading}
              placeholder="Ej: Active, Paused, Closed"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Estado de Fase */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Estado de Fase (Propfirm)
            </label>
            <input
              type="text"
              value={phaseStatus}
              onChange={(e) => setPhaseStatus(e.target.value)}
              disabled={loading}
              placeholder="Ej: Phase 1, Phase 2, Passed, Failed"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Rol */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Rol
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              placeholder="Ej: Demo, Real, Propfirm"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Retiros */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={withdrawalsEnabled}
              onChange={(e) => setWithdrawalsEnabled(e.target.checked)}
              disabled={loading}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px", color: "#4b5563" }}>
              Retiros habilitados
            </span>
          </label>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#e5e7eb",
                color: "#1f2937",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Guardando..." : account ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
