// src/components/tradehub/Playbook.client.tsx
"use client";

import { useState, useEffect } from "react";

interface Setup {
  id: string;
  name: string;
  description: string | null;
}

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number;
  lots: number;
  stop_loss_price: number;
  take_profit_price: number;
  pnl: number;
  pnl_percent: number;
  setup_id: string | null;
}

interface SetupStats {
  setup: Setup;
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnL: number | null;
  avgPnL: number | null;
  recentTrades: Trade[];
}

export default function Playbook() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSetupId, setExpandedSetupId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch setups
        const setupsResponse = await fetch("/api/tradehub/setups");
        if (!setupsResponse.ok) {
          const statusCode = setupsResponse.status;
          if (statusCode === 401) {
            window.location.href = "/auth";
            return;
          }
          console.warn(`[Playbook] GET /api/tradehub/setups returned ${statusCode}`);
          setSetups([]);
        } else {
          const setupsData = await setupsResponse.json();
          setSetups(Array.isArray(setupsData) ? setupsData : []);
        }

        // Fetch all trades
        const tradesResponse = await fetch("/api/tradehub/trades");
        if (!tradesResponse.ok) {
          const statusCode = tradesResponse.status;
          if (statusCode === 401) {
            window.location.href = "/auth";
            return;
          }
          console.warn(`[Playbook] GET /api/tradehub/trades returned ${statusCode}`);
          setTrades([]);
        } else {
          const tradesData = await tradesResponse.json();
          setTrades(Array.isArray(tradesData) ? tradesData : []);
        }
      } catch (err: any) {
        console.error("[Playbook] Error fetching data:", err);
        // Continue with empty arrays
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateStats = (setup: Setup): SetupStats => {
    // Filter trades for this setup
    const setupTrades = trades.filter((trade) => trade.setup_id === setup.id);

    // Closed trades = trades with exit_date NOT NULL
    const closedTrades = setupTrades.filter((trade) => trade.exit_date !== null);

    // Win rate: closed trades with pnl > 0
    const winningTrades = closedTrades.filter((trade) => trade.pnl && trade.pnl > 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    // Total P&L: sum of all pnl
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

    // Average P&L per closed trade
    const avgPnL = closedTrades.length > 0 ? totalPnL / closedTrades.length : null;

    // Recent trades (last 10)
    const recentTrades = setupTrades.slice(0, 10);

    return {
      setup,
      totalTrades: setupTrades.length,
      closedTrades: closedTrades.length,
      winRate,
      totalPnL: closedTrades.length > 0 ? totalPnL : null,
      avgPnL,
      recentTrades,
    };
  };

  const statsArray = setups.map(calculateStats);
  const hasSetups = statsArray.length > 0;

  return (
    <div className="w-full">
      {/* Header */}
      <h2 className="text-2xl font-bold text-white mb-6">📖 Playbook</h2>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-slate-400">Cargando playbook...</div>
      ) : !hasSetups ? (
        <div className="text-center text-slate-400 py-8">
          No hay setups creados. Crea uno en el tab &quot;New Trades Log&quot;.
        </div>
      ) : (
        <div className="space-y-4">
          {statsArray.map((stats) => (
            <div
              key={stats.setup.id}
              className="bg-slate-700/50 border border-slate-600 rounded-lg overflow-hidden"
            >
              {/* Header - Summary */}
              <button
                onClick={() =>
                  setExpandedSetupId(
                    expandedSetupId === stats.setup.id ? null : stats.setup.id
                  )
                }
                className="w-full p-4 hover:bg-slate-700/70 transition flex items-center justify-between"
              >
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {stats.setup.name}
                  </h3>
                  {stats.setup.description && (
                    <p className="text-sm text-slate-400 mt-1">
                      {stats.setup.description}
                    </p>
                  )}
                </div>

                {/* Stats Summary */}
                <div className="flex gap-6 ml-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Trades</p>
                    <p className="text-white font-semibold">
                      {stats.closedTrades}/{stats.totalTrades}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">Win Rate</p>
                    <p className="text-white font-semibold">
                      {stats.winRate.toFixed(0)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total P&L</p>
                    <p
                      className={`font-semibold ${
                        stats.totalPnL && stats.totalPnL > 0
                          ? "text-green-400"
                          : stats.totalPnL && stats.totalPnL < 0
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {stats.totalPnL !== null
                        ? `${stats.totalPnL > 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}`
                        : "-"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">Avg P&L</p>
                    <p
                      className={`font-semibold ${
                        stats.avgPnL && stats.avgPnL > 0
                          ? "text-green-400"
                          : stats.avgPnL && stats.avgPnL < 0
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {stats.avgPnL !== null
                        ? `${stats.avgPnL > 0 ? "+" : ""}${stats.avgPnL.toFixed(2)}`
                        : "-"}
                    </p>
                  </div>

                  <div className="flex items-center">
                    <p className="text-slate-400">
                      {expandedSetupId === stats.setup.id ? "▼" : "▶"}
                    </p>
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedSetupId === stats.setup.id && (
                <div className="border-t border-slate-600 p-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-600">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Total Trades</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.totalTrades}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Closed Trades</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.closedTrades}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.winRate.toFixed(1)}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Open Trades</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.totalTrades - stats.closedTrades}
                      </p>
                    </div>
                  </div>

                  {/* Recent Trades */}
                  {stats.recentTrades.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-3">
                        Últimas Operaciones
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {stats.recentTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className="p-3 bg-slate-600/50 rounded text-sm flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <p className="text-white font-semibold">
                                {trade.symbol} • {trade.direction}
                              </p>
                              <p className="text-xs text-slate-400">
                                {trade.entry_date}
                                {trade.exit_date && ` → ${trade.exit_date}`}
                              </p>
                            </div>

                            <div className="text-right">
                              <p
                                className={`font-semibold text-sm ${
                                  trade.pnl && trade.pnl > 0
                                    ? "text-green-400"
                                    : trade.pnl && trade.pnl < 0
                                    ? "text-red-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {trade.pnl !== null
                                  ? `${trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}`
                                  : "-"}
                              </p>
                              <p className="text-xs text-slate-400">
                                {trade.exit_date ? "✓ Cerrado" : "○ Abierto"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
