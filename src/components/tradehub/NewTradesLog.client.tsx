"use client";

import { useState } from "react";

interface Setup {
  id: string;
  name: string;
}
interface Trade {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry_date: string;
  exit_date?: string;
  pnl?: number;
  setup?: Setup;
}

export default function NewTradesLog() {
  const [trades] = useState<Trade[]>([{
    id: "1",
    symbol: "EURUSD",
    direction: "Long",
    status: "Closed",
    entry_date: "2026-02-12",
    exit_date: "2026-02-13",
    pnl: 120.5,
    setup: { id: "s1", name: "Breakout" }
  }]);
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Trades Log</h2>
      <div className="space-y-2">
        {trades.map(trade => (
          <div key={trade.id} className="p-4 bg-slate-700/50 border border-slate-600 rounded">
            <div className="font-semibold text-white">{trade.symbol} • {trade.direction} • {trade.status}</div>
            <div className="text-sm text-slate-300">{trade.entry_date}{trade.exit_date && ` → ${trade.exit_date}`}</div>
            {trade.setup?.name && <div className="text-xs text-slate-400">Setup: {trade.setup.name}</div>}
            {typeof trade.pnl === "number" && (
              <div className={`text-sm font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                P&L: {trade.pnl > 0 ? "+" : ""}{trade.pnl.toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

      // Optimistic update: Add to list immediately
      if (!editingTrade) {
        // New trade - prepend to list
        setTrades(prev => [savedTrade, ...prev]);
      } else {
        // Updated trade - replace in list
        setTrades(prev => prev.map(t => t.id === savedTrade.id ? savedTrade : t));
      }

      notifyTradeUpdate({
        reason: editingTrade ? "update" : "create",
        tradeId: savedTrade?.id,
        accountId: savedTrade?.account_id,
        source: "tradehub",
      });

      resetForm();
      await fetchTrades();
    } catch (err: any) {
      await logger.error(
        "tradehub",
        "Error saving trade",
        err instanceof Error ? err : undefined
      );
      logClientError(err, {
        feature: "trades",
        action: "save",
        tradeId: editingTrade?.id,
      });
      const raw = err instanceof Error ? err.message : "";
      if (raw.toLowerCase().includes("not found")) {
        setError("Operación no encontrada.");
      } else if (raw.toLowerCase().includes("forbidden")) {
        setError("No tienes permisos para editar esta operación.");
      } else {
        setError("No se pudo guardar la operación. Intenta de nuevo.");
      }
    }
  };
  // On mount: try to sync any offline trades
  useEffect(() => {
    const syncOffline = async () => {
      const pending = offlineQueue.getPending();
      for (const item of pending) {
        try {
          const response = await fetch("/api/tradehub/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (response.ok) {
            offlineQueue.markSynced(item.id);
            // Optionally update UI
            await fetchTrades();
          }
        } catch (e) {
          // Still offline, skip
        }
      }
    };
    syncOffline();
    // Optionally, poll every 30s
    const interval = setInterval(syncOffline, 30000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const handleDelete = async (tradeId: string) => {
    try {
      setError("");
      setTrades((prev) => prev.filter((t) => t.id !== tradeId));
      const response = await fetch(`/api/tradehub/trades/${tradeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to delete trade");
      }

      notifyTradeUpdate({
        reason: "delete",
        tradeId,
        source: "tradehub",
      });

      await fetchTrades();
      setDeleteConfirm(null);
    } catch (err: any) {
      await logger.error(
        "tradehub",
        "Error deleting trade",
        err instanceof Error ? err : undefined
      );
      logClientError(err, {
        feature: "trades",
        action: "delete",
        tradeId,
      });
      setError("No se pudo eliminar la operación. Intenta de nuevo.");
      await fetchTrades();
    }
  };

  const handleRestore = async (tradeId: string) => {
    try {
      setError("");
      const response = await fetch(`/api/tradehub/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore trade");
      }

      notifyTradeUpdate({
        reason: "restore",
        tradeId,
        source: "tradehub",
      });

      await fetchTrades();
    } catch (err: any) {
      await logger.error(
        "tradehub",
        "Error restoring trade",
        err instanceof Error ? err : undefined
      );
      logClientError(err, {
        feature: "trades",
        action: "restore",
        tradeId,
      });
      setError("No se pudo restaurar la operación.");
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          {showTrash ? "🗑️ Papelera" : "📊 New Trades Log"}
        </h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showTrash}
              onChange={(e) => {
                setShowTrash(e.target.checked);
                setShowForm(false);
              }}
              className="w-4 h-4"
            />
            Ver papelera
          </label>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Account Selector & Create Button */}
      {!showTrash && (
        <div className="mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cuenta
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setFormData({ ...formData, accountId: e.target.value });
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
            >
              <option value="">Selecciona una cuenta...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="mt-2 text-sm text-yellow-400">
                No tienes cuentas. <a href="/dashboard/tradehub?tab=accounts" className="underline">Ir a Accounts</a>
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (!selectedAccountId) {
                setError("Debes seleccionar una cuenta antes de crear una operación");
                return;
              }
              setShowForm(!showForm);
              if (!showForm) {
                setFormData({ ...formData, accountId: selectedAccountId });
              }
            }}
            disabled={!selectedAccountId}
            className={`px-4 py-2 rounded font-semibold ${
              selectedAccountId
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-600 text-slate-400 cursor-not-allowed"
            }`}
            title={!selectedAccountId ? "Selecciona una cuenta primero" : ""}
          >
            {showForm ? "Cancelar" : "+ Nueva Operación"}
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && !showTrash && (
        <div className="mb-6 p-6 bg-slate-700/50 border border-slate-600 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingTrade ? "Editar Operación" : "Nueva Operación"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="EURUSD, AAPL, etc."
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Direction */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Direction *
              </label>
              <input
                type="text"
                list="direction-list"
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                placeholder="Long, Short, Buy, Sell..."
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
              <datalist id="direction-list">
                {DIRECTION_SUGGESTIONS.map((dir) => (
                  <option key={dir} value={dir} />
                ))}
              </datalist>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Status *
              </label>
              <input
                type="text"
                list="status-list"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                placeholder="Open, Closed..."
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
              <datalist id="status-list">
                {STATUS_SUGGESTIONS.map((stat) => (
                  <option key={stat} value={stat} />
                ))}
              </datalist>
            </div>

            {/* Entry Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Entry Date *
              </label>
              <input
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            {/* Exit Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Exit Date
              </label>
              <input
                type="date"
                value={formData.exitDate}
                onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            {/* Entry Price */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Entry Price
              </label>
              <input
                type="number"
                step="0.00001"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                placeholder="1.2050"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Exit Price */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Exit Price
              </label>
              <input
                type="number"
                step="0.00001"
                value={formData.exitPrice}
                onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                placeholder="1.2150"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Lots */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Lots *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.lots}
                onChange={(e) => setFormData({ ...formData, lots: e.target.value })}
                placeholder="1.0"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Stop Loss Price */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Stop Loss Price *
              </label>
              <input
                type="number"
                step="0.00001"
                value={formData.stopLossPrice}
                onChange={(e) => setFormData({ ...formData, stopLossPrice: e.target.value })}
                placeholder="1.1950"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Take Profit Price */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Take Profit Price *
              </label>
              <input
                type="number"
                step="0.00001"
                value={formData.takeProfitPrice}
                onChange={(e) => setFormData({ ...formData, takeProfitPrice: e.target.value })}
                placeholder="1.2250"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* P&L */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                P&L
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pnl}
                onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* PnL % */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                PnL % *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pnlPercent}
                onChange={(e) => setFormData({ ...formData, pnlPercent: e.target.value })}
                placeholder="2.50"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            {/* Setup */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Setup
              </label>
              <select
                value={formData.setupId}
                onChange={(e) => setFormData({ ...formData, setupId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Sin setup</option>
                {setups.map((setup) => (
                  <option key={setup.id} value={setup.id}>
                    {setup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Featured */}
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-slate-300">
                Featured in report
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas sobre la operación..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
          </div>

          {/* Screenshot Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Screenshot (opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleScreenshotUpload}
              disabled={uploadingScreenshot || !editingTrade}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-slate-300"
            />
            {uploadingScreenshot && <p className="text-sm text-slate-400 mt-1">Uploading...</p>}
            {screenshotUrl && (
              <div className="mt-2">
                <p className="text-xs text-slate-400 mb-2">Preview:</p>
                <Image
                  src={screenshotUrl}
                  alt="Screenshot preview"
                  width={320}
                  height={160}
                  className="max-w-xs max-h-40 rounded border border-slate-500 object-contain"
                  unoptimized
                />
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
          >
            {editingTrade ? "Actualizar" : "Guardar"} Operación
          </button>
        </div>
      )}

      {/* Trades List */}
      {loading ? (
        <div className="text-slate-400">Cargando operaciones...</div>
      ) : trades.length === 0 ? (
        <div className="text-center text-slate-400 py-8">
          {showTrash
            ? "No hay operaciones en la papelera"
            : "No hay operaciones. Crea una nueva para comenzar."}
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="p-4 bg-slate-700/50 border border-slate-600 rounded flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="font-semibold text-white">
                  {trade.symbol} • {trade.direction} • {trade.status}
                </p>
                <p className="text-sm text-slate-300">
                  {trade.entry_date}
                  {trade.exit_date && ` → ${trade.exit_date}`}
                </p>
                {trade.setup?.name && (
                  <p className="text-xs text-slate-400">Setup: {trade.setup.name}</p>
                )}
                {trade.pnl !== null && (
                  <p className={`text-sm font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    P&L: {trade.pnl > 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {showTrash ? (
                  <>
                    <button
                      onClick={() => handleRestore(trade.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      RESTAURAR
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(trade)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(trade.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                    >
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded p-6 max-w-sm">
            <p className="text-white mb-4">¿Estás seguro de eliminar esta operación?</p>
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

