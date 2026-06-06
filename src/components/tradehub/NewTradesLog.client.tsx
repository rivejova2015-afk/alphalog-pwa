"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notifyTradeUpdate } from "@/lib/metrics/tradeUpdates";
import { normalizeTradeDirection } from "@/lib/trade/normalize";
import {
  enqueueOfflineMutation,
  getPendingForTable,
  isNetworkError,
} from "@/lib/alphacore/offline/networkFallback";
import {
  deleteOutboxEntry,
  updateOutboxPayload,
  type IDBOutboxEntry,
} from "@/lib/alphacore/offline/idb";
import {
  isPendingId as isPendingTradeId,
  pendingIdToOutboxId as pendingTradeIdToOutboxId,
  outboxIdToPendingId,
} from "@/lib/alphacore/offline/pendingIds";
import { CloudOff } from "lucide-react";

interface Account {
  id: string;
  name: string;
  currency?: string;
  status?: string;
}

interface Setup {
  id: string;
  name: string;
}

interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  status: "open" | "closed";
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number;
  lots: number;
  stop_loss_price: number;
  take_profit_price: number;
  pnl: number | null;
  pnl_percent: number | null;
  notes: string | null;
  setup_id: string | null;
  is_featured_in_report?: boolean;
  created_at?: string;
  account?: { id: string; name: string } | null;
  setup?: { id: string; name: string } | null;
}

interface TradeForm {
  account_id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  status: "open" | "closed";
  entry_date: string;
  exit_date: string;
  entry_price: string;
  exit_price: string;
  lots: string;
  stop_loss_price: string;
  take_profit_price: string;
  pnl: string;
  pnl_percent: string;
  notes: string;
  setup_id: string;
  is_featured_in_report: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL_FORM: TradeForm = {
  account_id: "",
  symbol: "",
  direction: "BUY",
  status: "closed",
  entry_date: today(),
  exit_date: today(),
  entry_price: "",
  exit_price: "",
  lots: "",
  stop_loss_price: "",
  take_profit_price: "",
  pnl: "0",
  pnl_percent: "0",
  notes: "",
  setup_id: "",
  is_featured_in_report: false,
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

    if (json?.error?.trim()) return json.error;
  } catch {
    // ignore and try text
  }

  try {
    const text = await cloned.text();
    if (text?.trim()) return text;
  } catch {
    // keep fallback
  }

  return fallback;
}

function toNumber(value: string, label: string, opts?: { min?: number; gt?: number }): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} debe ser numerico`);
  }
  if (opts?.min !== undefined && parsed < opts.min) {
    throw new Error(`${label} debe ser mayor o igual a ${opts.min}`);
  }
  if (opts?.gt !== undefined && parsed <= opts.gt) {
    throw new Error(`${label} debe ser mayor a ${opts.gt}`);
  }
  return parsed;
}

function formatCurrency(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function normalizeTradeStatus(input: unknown): "open" | "closed" {
  if (typeof input !== "string") return "closed";
  const value = input.trim().toLowerCase();
  return value === "open" ? "open" : "closed";
}

export default function NewTradesLog() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pendingTradesRaw, setPendingTradesRaw] = useState<IDBOutboxEntry[]>([]);

  const refreshPendingTrades = useCallback(async () => {
    try {
      const pending = await getPendingForTable("trades");
      setPendingTradesRaw(pending.filter((e) => e.operation === "create"));
    } catch {
      // Reading the outbox is best-effort.
    }
  }, []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [form, setForm] = useState<TradeForm>(INITIAL_FORM);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");

  const fetchAccounts = useCallback(async () => {
    const response = await fetch("/api/accounts");
    if (!response.ok) {
      throw new Error(await parseApiError(response, "No se pudieron cargar cuentas"));
    }
    const data = (await response.json()) as Account[];
    setAccounts(Array.isArray(data) ? data : []);
  }, []);

  const fetchSetups = useCallback(async () => {
    const response = await fetch("/api/tradehub/setups");
    if (!response.ok) {
      throw new Error(await parseApiError(response, "No se pudieron cargar setups"));
    }
    const data = (await response.json()) as Setup[];
    setSetups(Array.isArray(data) ? data : []);
  }, []);

  const fetchTrades = useCallback(async (accountId?: string) => {
    const params = new URLSearchParams({ limit: "200", offset: "0" });
    if (accountId) params.set("accountId", accountId);

    const response = await fetch(`/api/tradehub/trades?${params.toString()}`);
    if (!response.ok) {
      throw new Error(await parseApiError(response, "No se pudieron cargar trades"));
    }

    const data = (await response.json()) as Trade[];
    const normalized = Array.isArray(data)
      ? data.map((trade) => ({
          ...trade,
          direction: normalizeTradeDirection(trade.direction) || "BUY",
          status: normalizeTradeStatus(trade.status),
        }))
      : [];
    setTrades(normalized);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([fetchAccounts(), fetchSetups(), fetchTrades(filterAccountId || undefined)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar TradeHub");
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts, fetchSetups, fetchTrades, filterAccountId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const pendingTrades = useMemo<Trade[]>(() => {
    return pendingTradesRaw.map((entry) => {
      const p = (entry.payload || {}) as Partial<Trade> & { account_id?: string };
      return {
        id: outboxIdToPendingId(entry.id),
        account_id: p.account_id || "",
        symbol: p.symbol || "",
        direction: (p.direction === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        status: (p.status === "open" ? "open" : "closed") as "open" | "closed",
        entry_date: p.entry_date || new Date(entry.createdAt).toISOString().slice(0, 10),
        exit_date: p.exit_date ?? null,
        entry_price: typeof p.entry_price === "number" ? p.entry_price : 0,
        exit_price: typeof p.exit_price === "number" ? p.exit_price : 0,
        lots: typeof p.lots === "number" ? p.lots : 0,
        stop_loss_price: typeof p.stop_loss_price === "number" ? p.stop_loss_price : 0,
        take_profit_price: typeof p.take_profit_price === "number" ? p.take_profit_price : 0,
        pnl: typeof p.pnl === "number" ? p.pnl : null,
        pnl_percent: typeof p.pnl_percent === "number" ? p.pnl_percent : null,
        notes: typeof p.notes === "string" ? p.notes : null,
        setup_id: typeof p.setup_id === "string" ? p.setup_id : null,
        is_featured_in_report: Boolean(p.is_featured_in_report),
        created_at: new Date(entry.createdAt).toISOString(),
      };
    });
  }, [pendingTradesRaw]);

  const sortedTrades = useMemo(() => {
    // Pending trades go on top — the user just registered them and would be
    // confused not seeing them in the list.
    const sortedPending = [...pendingTrades].sort((a, b) => {
      const left = new Date(a.exit_date || a.entry_date).getTime();
      const right = new Date(b.exit_date || b.entry_date).getTime();
      return right - left;
    });
    const sortedServer = [...trades].sort((a, b) => {
      const left = new Date(a.exit_date || a.entry_date).getTime();
      const right = new Date(b.exit_date || b.entry_date).getTime();
      return right - left;
    });
    return [...sortedPending, ...sortedServer];
  }, [trades, pendingTrades]);

  // Refresh pending list on mount and periodically so successful background
  // syncs flip the badge off without the user reloading.
  useEffect(() => {
    void refreshPendingTrades();
    if (typeof window === "undefined") return;
    const onOnline = () => {
      window.setTimeout(() => {
        void refreshPendingTrades();
        void fetchTrades(filterAccountId || undefined);
      }, 3500);
    };
    window.addEventListener("online", onOnline);
    const intervalId = window.setInterval(() => void refreshPendingTrades(), 7000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshPendingTrades, filterAccountId]);

  const resetForm = useCallback(() => {
    setForm((prev) => ({
      ...INITIAL_FORM,
      account_id: prev.account_id || accounts[0]?.id || "",
    }));
    setEditingTradeId(null);
    setScreenshotFile(null);
  }, [accounts]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setForm({
      account_id: trade.account_id,
      symbol: trade.symbol,
      direction: normalizeTradeDirection(trade.direction) || "BUY",
      status: normalizeTradeStatus(trade.status),
      entry_date: trade.entry_date,
      exit_date: trade.exit_date || "",
      entry_price: String(trade.entry_price ?? ""),
      exit_price: String(trade.exit_price ?? ""),
      lots: String(trade.lots ?? ""),
      stop_loss_price: String(trade.stop_loss_price ?? ""),
      take_profit_price: String(trade.take_profit_price ?? ""),
      pnl: String(trade.pnl ?? 0),
      pnl_percent: String(trade.pnl_percent ?? 0),
      notes: trade.notes || "",
      setup_id: trade.setup_id || "",
      is_featured_in_report: !!trade.is_featured_in_report,
    });
    setScreenshotFile(null);
    setShowForm(true);
  };

  const uploadScreenshotIfNeeded = async (tradeId: string) => {
    if (!screenshotFile) return;

    const formData = new FormData();
    formData.append("file", screenshotFile);

    const response = await fetch(`/api/tradehub/trades/${tradeId}/screenshot`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await parseApiError(response, "Trade guardado, pero no se pudo subir screenshot");
      throw new Error(message);
    }
  };

  const handleSave = async () => {
    try {
      setError("");

      if (!form.account_id) throw new Error("Debes seleccionar una cuenta");
      if (!form.symbol.trim()) throw new Error("El simbolo es obligatorio");
      if (!form.entry_date) throw new Error("La fecha de entrada es obligatoria");

      const entryPrice = toNumber(form.entry_price, "Entry price", { gt: 0 });
      const exitPrice = toNumber(form.exit_price, "Exit price", { gt: 0 });
      const lots = toNumber(form.lots, "Lots", { gt: 0 });
      const stopLoss = toNumber(form.stop_loss_price, "Stop loss", { min: 0 });
      const takeProfit = toNumber(form.take_profit_price, "Take profit", { min: 0 });
      const pnl = toNumber(form.pnl, "PnL");
      const pnlPercent = toNumber(form.pnl_percent, "PnL %");

      if (form.status === "closed" && !form.exit_date) {
        throw new Error("Para un trade cerrado la fecha de salida es obligatoria");
      }

      const payload = {
        account_id: form.account_id,
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        status: form.status,
        entry_date: form.entry_date,
        exit_date: form.status === "open" ? null : form.exit_date,
        entry_price: entryPrice,
        exit_price: exitPrice,
        lots,
        stop_loss_price: stopLoss,
        take_profit_price: takeProfit,
        pnl,
        pnl_percent: pnlPercent,
        notes: form.notes.trim(),
        setup_id: form.setup_id || null,
        is_featured_in_report: form.is_featured_in_report,
      };

      setSaving(true);

      const isEditing = Boolean(editingTradeId);
      const editingPending = isEditing && editingTradeId !== null && isPendingTradeId(editingTradeId);

      // Special path: the user is editing a row that is still pending in
      // the outbox (the server has never seen it). Instead of enqueueing a
      // PATCH that would need to resolve the not-yet-existent server id at
      // sync time, mutate the CREATE payload in place — when it finally
      // drains it carries the latest values.
      if (editingPending && editingTradeId) {
        try {
          await updateOutboxPayload(
            pendingTradeIdToOutboxId(editingTradeId),
            payload as Record<string, unknown>
          );
          await refreshPendingTrades();
          setShowForm(false);
          resetForm();
          setError("");
        } catch {
          setError("No se pudo actualizar el trade pendiente.");
        } finally {
          setSaving(false);
        }
        return;
      }

      const endpoint = isEditing ? `/api/tradehub/trades/${editingTradeId}` : "/api/tradehub/trades";
      const method = isEditing ? "PATCH" : "POST";

      try {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, "No se pudo guardar el trade"));
        }

        const savedTrade = (await response.json()) as { id?: string; account_id?: string };
        const tradeId = savedTrade.id || editingTradeId;

        if (tradeId) {
          try {
            await uploadScreenshotIfNeeded(tradeId);
          } catch (screenshotError) {
            setError(
              screenshotError instanceof Error ? screenshotError.message : "No se pudo subir screenshot"
            );
          }

          notifyTradeUpdate({
            reason: isEditing ? "update" : "create",
            tradeId,
            accountId: savedTrade.account_id || form.account_id,
            source: "tradehub:new-trades-log",
          });
        }

        await fetchTrades(filterAccountId || undefined);
        setShowForm(false);
        resetForm();
      } catch (innerErr) {
        if (!isNetworkError(innerErr)) {
          throw innerErr;
        }
        // Network-only fallback: queue create OR update against an existing
        // server-side trade. Screenshots are intentionally NOT queued (they
        // need a real id; cargarlas tras drain queda fuera del scope).
        try {
          if (isEditing && editingTradeId) {
            await enqueueOfflineMutation({
              endpoint: `/api/tradehub/trades/${editingTradeId}`,
              method: "PATCH",
              table: "trades",
              payload: { ...(payload as Record<string, unknown>), id: editingTradeId },
              operation: "update",
            });
            // Optimistic local update so the row reflects the new values
            // without a refetch.
            setTrades((prev) =>
              prev.map((t) =>
                t.id === editingTradeId
                  ? {
                      ...t,
                      ...(payload as Record<string, unknown>),
                    } as typeof t
                  : t
              )
            );
          } else {
            await enqueueOfflineMutation({
              endpoint: "/api/tradehub/trades",
              method: "POST",
              table: "trades",
              payload: payload as Record<string, unknown>,
              operation: "create",
            });
            await refreshPendingTrades();
          }
          setShowForm(false);
          resetForm();
          setError("");
        } catch {
          setError("Sin conexión y tampoco se pudo encolar offline.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el trade");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (trade: Trade) => {
    const confirmed = window.confirm(`Eliminar operacion ${trade.symbol}? Esta accion es permanente.`);
    if (!confirmed) return;

    // Pending trade — never made it to the server. Cancel the outbox
    // entry directly; no DELETE call needed.
    if (isPendingTradeId(trade.id)) {
      try {
        await deleteOutboxEntry(pendingTradeIdToOutboxId(trade.id));
        setError("");
        await refreshPendingTrades();
      } catch {
        setError("No se pudo descartar el trade pendiente.");
      }
      return;
    }

    try {
      setError("");
      const response = await fetch(`/api/tradehub/trades/${trade.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await parseApiError(response, "No se pudo eliminar el trade"));
      }

      notifyTradeUpdate({
        reason: "delete",
        tradeId: trade.id,
        accountId: trade.account_id,
        source: "tradehub:new-trades-log",
      });

      await fetchTrades(filterAccountId || undefined);
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          await enqueueOfflineMutation({
            endpoint: `/api/tradehub/trades/${trade.id}`,
            method: "DELETE",
            table: "trades",
            payload: { id: trade.id },
            operation: "delete",
          });
          // Hide the row immediately — the outbox will drain the delete
          // when the connection comes back.
          setTrades((prev) => prev.filter((t) => t.id !== trade.id));
          setError("");
        } catch {
          setError("Sin conexión y tampoco se pudo encolar el borrado.");
        }
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo eliminar el trade");
    }
  };

  if (loading) {
    return <div className="p-4 text-slate-400">Cargando trades...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">New Trades Log</h2>
          <p className="text-sm text-slate-400">Registro real de operaciones con edicion y borrado.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterAccountId}
            onChange={(event) => setFilterAccountId(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void fetchTrades(filterAccountId || undefined)}
            className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          >
            Refrescar
          </button>
          <a
            href={`/api/tradehub/trades/export${filterAccountId ? `?accountId=${filterAccountId}` : ""}`}
            download
            className="rounded bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
            aria-label="Exportar trades como CSV"
          >
            Exportar CSV
          </a>
          <button
            onClick={openCreate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nuevo trade
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>}

      {showForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-50">{editingTradeId ? "Editar trade" : "Crear trade"}</h3>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              Cuenta *
              <select
                value={form.account_id}
                onChange={(event) => setForm((prev) => ({ ...prev, account_id: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Selecciona cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Simbolo *
              <input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                placeholder="XAUUSD"
              />
            </label>

            <label className="text-sm text-slate-300">
              Direction *
              <select
                value={form.direction}
                onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value as "BUY" | "SELL" }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Status *
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "open" | "closed" }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="open">open</option>
                <option value="closed">closed</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Entry date *
              <input
                type="date"
                value={form.entry_date}
                onChange={(event) => setForm((prev) => ({ ...prev, entry_date: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Exit date
              <input
                type="date"
                value={form.exit_date}
                onChange={(event) => setForm((prev) => ({ ...prev, exit_date: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Entry price *
              <input
                type="number"
                step="any"
                value={form.entry_price}
                onChange={(event) => setForm((prev) => ({ ...prev, entry_price: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Exit price *
              <input
                type="number"
                step="any"
                value={form.exit_price}
                onChange={(event) => setForm((prev) => ({ ...prev, exit_price: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Lots *
              <input
                type="number"
                step="any"
                value={form.lots}
                onChange={(event) => setForm((prev) => ({ ...prev, lots: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Stop loss *
              <input
                type="number"
                step="any"
                value={form.stop_loss_price}
                onChange={(event) => setForm((prev) => ({ ...prev, stop_loss_price: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Take profit *
              <input
                type="number"
                step="any"
                value={form.take_profit_price}
                onChange={(event) => setForm((prev) => ({ ...prev, take_profit_price: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              PnL
              <input
                type="number"
                step="any"
                value={form.pnl}
                onChange={(event) => setForm((prev) => ({ ...prev, pnl: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              PnL %
              <input
                type="number"
                step="any"
                value={form.pnl_percent}
                onChange={(event) => setForm((prev) => ({ ...prev, pnl_percent: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="text-sm text-slate-300">
              Setup
              <select
                value={form.setup_id}
                onChange={(event) => setForm((prev) => ({ ...prev, setup_id: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Sin setup</option>
                {setups.map((setup) => (
                  <option key={setup.id} value={setup.id}>
                    {setup.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Screenshot (opcional)
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setScreenshotFile(event.target.files?.[0] || null)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm text-slate-300">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.is_featured_in_report}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_featured_in_report: event.target.checked }))
              }
            />
            Destacar en reportes
          </label>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-slate-600"
            >
              {saving ? "Guardando..." : editingTradeId ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      )}

      {sortedTrades.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-slate-400">Sin operaciones registradas.</div>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="table-mobile-cards min-w-full text-sm text-slate-200">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Cuenta</th>
                <th className="px-3 py-2 text-left">Setup</th>
                <th className="px-3 py-2 text-left">Dir</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">PnL</th>
                <th className="px-3 py-2 text-left">Exit</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map((trade) => {
                const accountName = trade.account?.name || accounts.find((acc) => acc.id === trade.account_id)?.name || "-";
                const setupName = trade.setup?.name || setups.find((setup) => setup.id === trade.setup_id)?.name || "-";
                const accountCurrency = accounts.find((acc) => acc.id === trade.account_id)?.currency || "USD";
                const isPending = isPendingTradeId(trade.id);

                return (
                  <tr
                    key={trade.id}
                    className={`border-b ${
                      isPending ? "border-amber-800/40 bg-amber-950/15" : "border-slate-800/60"
                    }`}
                  >
                    <td data-label="Symbol" className="px-3 py-2 font-medium text-slate-50">
                      <div className="flex items-center gap-2">
                        <span>{trade.symbol}</span>
                        {isPending && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                            title="Este trade aún no se sincronizó con el servidor"
                          >
                            <CloudOff className="w-3 h-3" />
                            Sync
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Cuenta" className="px-3 py-2">{accountName}</td>
                    <td data-label="Setup" className="px-3 py-2">{setupName}</td>
                    <td data-label="Dir" className="px-3 py-2">{trade.direction}</td>
                    <td data-label="Status" className="px-3 py-2">{trade.status}</td>
                    <td
                      data-label="PnL"
                      className={`px-3 py-2 text-right ${
                        (trade.pnl || 0) > 0 ? "text-green-400" : (trade.pnl || 0) < 0 ? "text-red-400" : "text-slate-200"
                      }`}
                    >
                      {formatCurrency(trade.pnl, accountCurrency)}
                    </td>
                    <td data-label="Exit" className="px-3 py-2">
                      {trade.exit_date ? new Date(trade.exit_date).toLocaleDateString("es-ES") : "-"}
                    </td>
                    <td data-label="Acciones" className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(trade)}
                          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
                          title={isPending ? "Editar el payload pendiente antes del sync" : undefined}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => void handleDelete(trade)}
                          className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-200 hover:bg-red-800"
                          title={isPending ? "Descartar el trade pendiente del outbox" : undefined}
                        >
                          {isPending ? "Descartar" : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
