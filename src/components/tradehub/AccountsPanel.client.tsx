// src/components/tradehub/AccountsPanel.client.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import AccountDialog from "./AccountDialog.client";

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
  category?: { name: string };
}

interface Category {
  id: string;
  name: string;
}

export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch categories (non-blocking)
      try {
        const categoriesResponse = await fetch("/api/account-categories");
        if (categoriesResponse.ok) {
          const cats: Category[] = await categoriesResponse.json();
          setCategories(Array.isArray(cats) ? cats : []);
        }
      } catch (err) {
        console.warn("[AccountsPanel] Categories fetch failed:", err);
        // Continue without categories
      }

      // Fetch accounts (active or deleted based on showTrash)
      const params = new URLSearchParams({
        trash: showTrash ? "true" : "false",
      });
      const response = await fetch(`/api/accounts?${params}`);
      if (!response.ok) {
        const statusCode = response.status;
        if (statusCode === 401) {
          // Unauthorized - redirect to auth
          window.location.href = "/auth";
          return;
        }
        console.error(`[AccountsPanel] GET /api/accounts returned ${statusCode}`);
        // Still show empty list with warning
        setAccounts([]);
        return;
      }

      const data = await response.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("[AccountsPanel] Error fetching accounts:", err);
      // Network error or JSON parse error - show empty list
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [showTrash]);

  useEffect(() => {
    fetchAccounts();
  }, [showTrash, fetchAccounts]);

  const handleSave = async (accountData: Partial<Account>) => {
    try {
      setError("");
      const method = editingAccount ? "PATCH" : "POST";
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : "/api/accounts";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.error || errData.message || "Error al guardar");
        return;
      }

      // Get the created/updated account from response
      const savedAccount = await response.json();
      
      // Optimistic update: Add to list immediately
      if (!editingAccount) {
        // New account - prepend to list
        setAccounts(prev => [savedAccount, ...prev]);
      } else {
        // Updated account - replace in list
        setAccounts(prev => prev.map(acc => acc.id === savedAccount.id ? savedAccount : acc));
      }

      setShowDialog(false);
      setEditingAccount(null);
      
      // Refetch to ensure consistency with server
      fetchAccounts();
    } catch (err: any) {
      console.error("[AccountsPanel] Error saving account:", err);
      setError(err?.message || "Error al guardar cuenta");
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      setError("");
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.error || "Failed to delete account");
        return;
      }

      // Optimistic update: Remove from list
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      setDeleteConfirm(null);
      
      // Refetch to ensure consistency
      fetchAccounts();
    } catch (err: any) {
      console.error("[AccountsPanel] Error deleting account:", err);
      setError(err?.message || "Error al eliminar cuenta");
    }
  };

  const handleRestore = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore account");
      }

      fetchAccounts();
    } catch (err: any) {
      console.error("Error restoring account:", err);
      setError("Error al restaurar cuenta");
    }
  };

  const handleEmptyTrash = async () => {
    const confirmed = confirm(
      "¿Estás seguro? Se eliminarán PERMANENTEMENTE todas las cuentas en la papelera. Esta acción NO se puede deshacer."
    );
    if (!confirmed) return;

    try {
      setEmptyingTrash(true);
      setError("");

      const response = await fetch("/api/accounts/trash/empty", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to empty trash");
      }

      setShowTrash(false);
      fetchAccounts();
    } catch (err: any) {
      console.error("Error emptying trash:", err);
      setError("Error al vaciar papelera");
    } finally {
      setEmptyingTrash(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "#6b7280" }}>
        Cargando cuentas...
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
          {showTrash ? "🗑️ Papelera" : "📋 Cuentas"}
        </h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!showTrash && (
            <button
              onClick={() => {
                setEditingAccount(null);
                setShowDialog(true);
              }}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + Nueva Cuenta
            </button>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showTrash}
              onChange={(e) => setShowTrash(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px", color: "#4b5563" }}>
              Ver papelera
            </span>
          </label>
        </div>
      </div>

      {/* Error */}
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

      {/* Vaciar Papelera */}
      {showTrash && accounts.length > 0 && (
        <button
          onClick={handleEmptyTrash}
          disabled={emptyingTrash}
          style={{
            padding: "10px 16px",
            fontSize: "14px",
            backgroundColor: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: emptyingTrash ? "not-allowed" : "pointer",
            opacity: emptyingTrash ? 0.6 : 1,
          }}
        >
          {emptyingTrash ? "Vaciando..." : "🗑️ Vaciar papelera"}
        </button>
      )}

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
          {showTrash ? "Sin cuentas en papelera" : "Sin cuentas. ¡Crea una!"}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {accounts.map((account) => (
            <div
              key={account.id}
              style={{
                padding: "12px",
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937" }}>
                  {account.name}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {account.category?.name || "Sin categoría"}
                  {account.role && ` • ${account.role}`}
                  {account.operation_state && ` • ${account.operation_state}`}
                </div>
                {account.current_balance !== null && (
                  <div style={{ fontSize: "12px", color: "#059669", marginTop: "2px" }}>
                    Balance: ${account.current_balance.toFixed(2)}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                {!showTrash ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingAccount(account);
                        setShowDialog(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#e0e7ff",
                        color: "#4338ca",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    {deleteConfirm === account.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(account.id)}
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
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            backgroundColor: "#e5e7eb",
                            color: "#1f2937",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                        }}
                      >
                        Borrar
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRestore(account.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Restaurar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <AccountDialog
          account={editingAccount || undefined}
          categories={categories}
          onSave={handleSave}
          onClose={() => {
            setShowDialog(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}
