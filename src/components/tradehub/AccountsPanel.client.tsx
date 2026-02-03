"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccountDialog from "./AccountDialog.client";
import CategoryManagerModal, { Category as CategoryType } from "./CategoryManagerModal.client";
import AccountDetailsModal from "./AccountDetailsModal.client";
import { computePnlTotals, filterTradesForPnl } from "@/lib/metrics/pnl";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";

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
  currency: string;
  status: string;
  category?: { id: string; name: string; description?: string | null } | null;
}

interface AccountStats {
  wins: number;
  losses: number;
  ops: number;
  winRate: number | null;
  topSetup: { name: string; count: number } | null;
  loading?: boolean;
  error?: string;
}

function formatCurrency(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch (_e) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [detailsAccountName, setDetailsAccountName] = useState("—");
  const [detailsCurrency, setDetailsCurrency] = useState<string | undefined>("USD");
  const [detailsBalance, setDetailsBalance] = useState<number | null | undefined>(null);
  const [detailsEquity, setDetailsEquity] = useState<number | null | undefined>(null);
  const [detailsStatus, setDetailsStatus] = useState<string | undefined>("active");
  const [stats, setStats] = useState<Record<string, AccountStats>>({});
  const [statsRefresh, setStatsRefresh] = useState(0);

  const sortedCategories = useMemo(() => {
    const list = [...categories];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const accountsByCategory = useMemo(() => {
    const map: Record<string, Account[]> = {};
    sortedCategories.forEach((cat) => {
      map[cat.id] = [];
    });
    accounts.forEach((acc) => {
      const key = acc.category_id || "__sin__";
      if (!map[key]) map[key] = [];
      map[key].push(acc);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [accounts, sortedCategories]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/account-categories");
      if (!res.ok) {
        throw new Error("failed");
      }
      const data = (await res.json()) as CategoryType[];
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      // keep previous categories
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setSessionExpired(false);
      await loadCategories();

      const res = await fetch("/api/accounts");
      const data = await res.json().catch(() => []);
      if (res.status === 401 || res.status === 403) {
        setSessionExpired(true);
        setAccounts([]);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar las cuentas");
      }
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar cuentas";
      setError(message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [loadCategories]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (accounts.length === 0) return;
    accounts.forEach((acc) => {
      void fetchAccountStats(acc.id);
    });
  }, [accounts, statsRefresh]);

  useEffect(() => {
    return subscribeTradeUpdates(() => {
      setStatsRefresh((prev) => prev + 1);
    });
  }, []);

  const fetchAccountStats = async (accountId: string) => {
    setStats((prev) => ({
      ...prev,
      [accountId]: { wins: 0, losses: 0, ops: 0, winRate: null, topSetup: null, loading: true },
    }));
    try {
      const params = new URLSearchParams({
        accountId,
        closedOnly: "true",
        range: "all",
        limit: "200",
        offset: "0",
      });
      const res = await fetch(`/api/tradehub/trades?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo calcular KPIs");
      }
      const trades = Array.isArray(data) ? data : [];
      const metrics = computePnlTotals(trades, {
        closedOnly: true,
        requireExitDate: true,
        ignoreZero: true,
      });
      const wins = metrics.wins;
      const losses = metrics.losses;
      const ops = metrics.ops;
      const winRate = metrics.winRate !== null ? Math.round(metrics.winRate) : null;
      const closed = filterTradesForPnl(trades, {
        closedOnly: true,
        requireExitDate: true,
        ignoreZero: true,
      });
      const setupCounts = new Map<string, { name: string; count: number }>();
      closed.forEach((t) => {
        const key = t.setup?.name || "Sin setup";
        const current = setupCounts.get(key) ?? { name: key, count: 0 };
        setupCounts.set(key, { name: current.name, count: current.count + 1 });
      });
      const topSetup = Array.from(setupCounts.values()).sort((a, b) => b.count - a.count)[0] || null;
      setStats((prev) => ({
        ...prev,
        [accountId]: { wins, losses, ops, winRate, topSetup },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al calcular KPIs";
      setStats((prev) => ({
        ...prev,
        [accountId]: { wins: 0, losses: 0, ops: 0, winRate: null, topSetup: null, error: message },
      }));
    }
  };

  const handleSaveAccount = async (accountData: Partial<Account>) => {
    try {
      setError("");
      const method = editingAccount ? "PATCH" : "POST";
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : "/api/accounts";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Error al guardar");
      }
      setShowAccountDialog(false);
      setEditingAccount(null);
      void fetchAccounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("accounts:updated"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar cuenta";
      setError(message);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Esto eliminará permanentemente la cuenta y todas sus operaciones/evidencias asociadas. ¿Continuar?")) return;
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo eliminar");
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      void fetchAccounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("accounts:updated"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar";
      setError(message);
    }
  };

  const openDetails = (acc: Account) => {
    setDetailsAccountId(acc.id);
    setDetailsAccountName(acc.name);
    setDetailsCurrency(acc.currency);
    setDetailsBalance(acc.current_balance);
    setDetailsEquity(acc.account_size);
    setDetailsStatus(acc.status);
  };

  if (loading) {
    return <div className="text-slate-400 p-4">Cargando cuentas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Accounts</h2>
          <p className="text-sm text-slate-400">Categorías siempre visibles y KPIs por cuenta</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="px-3 py-2 rounded-lg border border-slate-700 text-slate-100 bg-slate-900 hover:bg-slate-800 text-sm"
          >
            Nueva/Manage Categoría
          </button>
          <button
            onClick={() => {
              setEditingAccount(null);
              setShowAccountDialog(true);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Nueva Cuenta
          </button>
          <button
            onClick={() => void fetchAccounts()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
          >
            Refrescar
          </button>
        </div>
      </div>

      {sessionExpired && (
        <div className="p-4 rounded-lg border border-yellow-800 bg-yellow-900/20 text-yellow-200">
          Tu sesión expiró. Vuelve a iniciar sesión. <a className="underline" href="/auth">Ir a Login</a>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-800 bg-red-900/20 text-red-200">{error}</div>
      )}

      <div className="space-y-4">
        {sortedCategories.map((cat) => {
          const accountsForCat = accountsByCategory[cat.id] || [];
          return (
            <div key={cat.id} className="rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div>
                  <div className="text-base font-semibold text-slate-50">{cat.name}</div>
                  {cat.description && <div className="text-sm text-slate-400">{cat.description}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCategoryManager(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setShowCategoryManager(true)}
                    className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800 text-red-200 text-xs"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {accountsForCat.length === 0 ? (
                  <div className="text-sm text-slate-400">Sin cuentas en esta categoría.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {accountsForCat.map((acc) => {
                      const stat = stats[acc.id];
                      return (
                        <div key={acc.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="text-lg font-semibold text-slate-50">{acc.name}</div>
                              <div className="text-sm text-slate-400">
                                {acc.currency} · Balance {formatCurrency(acc.current_balance, acc.currency)} · Equity {formatCurrency(acc.account_size, acc.currency)}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border ${acc.status === "archived" ? "border-slate-700 text-slate-400" : "border-green-700 text-green-300"}`}>
                              {acc.status === "archived" ? "Archivada" : "Activa"}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                              <div className="text-xs text-slate-400">Winrate</div>
                              <div className="text-slate-50 font-semibold">{stat?.winRate !== undefined && stat?.winRate !== null ? `${stat.winRate}%` : stat?.loading ? "..." : "—"}</div>
                            </div>
                            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                              <div className="text-xs text-slate-400">Ops</div>
                              <div className="text-slate-50 font-semibold">{stat?.ops ?? (stat?.loading ? "..." : 0)}</div>
                            </div>
                            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                              <div className="text-xs text-slate-400">Top setup</div>
                              <div className="text-slate-50 font-semibold truncate">{stat?.topSetup?.name || (stat?.loading ? "..." : "—")}</div>
                            </div>
                          </div>
                          {stat?.error && <div className="text-xs text-red-300">{stat.error}</div>}

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setEditingAccount(acc);
                                setShowAccountDialog(true);
                              }}
                              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDetails(acc)}
                              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs"
                            >
                              Detalles
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="px-3 py-1.5 rounded-md bg-red-900/40 hover:bg-red-800 text-red-200 text-xs"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sortedCategories.length === 0 && (
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 text-slate-300">No hay categorías. Crea una para comenzar.</div>
        )}
      </div>

      {showAccountDialog && (
        <AccountDialog
          account={editingAccount || undefined}
          categories={categories}
          onSave={handleSaveAccount}
          onClose={() => {
            setShowAccountDialog(false);
            setEditingAccount(null);
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal
          open={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          onUpdated={() => {
            void loadCategories();
            void fetchAccounts();
          }}
        />
      )}

      {detailsAccountId && (
        <AccountDetailsModal
          open={!!detailsAccountId}
          accountId={detailsAccountId}
          accountName={detailsAccountName}
          currency={detailsCurrency}
          balance={detailsBalance}
          equity={detailsEquity}
          status={detailsStatus}
          onClose={() => setDetailsAccountId(null)}
        />
      )}
    </div>
  );
}
