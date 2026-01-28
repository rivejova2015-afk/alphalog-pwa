// src/components/tradehub/Playbook.client.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SetupDetailsModal from "./SetupDetailsModal.client";
import CreateSetupModal from "./CreateSetupModal.client";
import { computePnlTotals, filterTradesForPnl } from "@/lib/metrics/pnl";
import { subscribeTradeUpdates } from "@/lib/metrics/tradeUpdates";

interface Setup {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}
interface Trade {
  id: string;
  setup_id?: string | null;
  pnl?: number | null;
  exit_date?: string | null;
  direction?: string;
  size?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  symbol?: string;
  r?: number | null;
  notes?: string | null;
  tags?: string[];
}

interface SetupStats {
  winrate: number | null;
  wins: number;
  losses: number;
  ops: number;
  profitNeto: number;
  lastUsed: string | null;
  loading?: boolean;
  error?: string;
}

function formatCurrency(value: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function Playbook() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [stats, setStats] = useState<Record<string, SetupStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
  const [selectedSetupName, setSelectedSetupName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statsRefresh, setStatsRefresh] = useState(0);

  const fetchSetups = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/tradehub/setups");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los setups");
      }
      setSetups(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar setups";
      setError(msg);
      setSetups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSetups();
  }, [fetchSetups]);

  // Cargar stats para cada setup cuando se carguen los setups
  useEffect(() => {
    if (setups.length === 0) return;
    setups.forEach((setup) => {
      void fetchSetupStats(setup.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setups, statsRefresh]);

  useEffect(() => {
    return subscribeTradeUpdates(() => {
      setStatsRefresh((prev) => prev + 1);
    });
  }, []);

  const fetchSetupStats = async (setupId: string) => {
    setStats((prev) => ({
      ...prev,
      [setupId]: {
        winrate: null,
        wins: 0,
        losses: 0,
        ops: 0,
        profitNeto: 0,
        lastUsed: null,
        loading: true,
      },
    }));
    try {
      // Traer todos los trades del setup (ALL TIME), solo cerrados
      const params = new URLSearchParams({
        setupId,
        closedOnly: "true",
        range: "all",
        limit: "500",
        offset: "0",
      });
      const res = await fetch(`/api/tradehub/trades?${params.toString()}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data?.error || "Error al cargar trades");
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
      const winrate = metrics.winRate !== null ? Math.round(metrics.winRate) : null;
      const profitNeto = metrics.totalPnl;

      const closed = filterTradesForPnl(trades, {
        closedOnly: true,
        requireExitDate: true,
        ignoreZero: true,
      });

      // Last used = ?ltima exit_date (first en orden desc)
      const lastUsed = closed.length > 0 && closed[0]?.exit_date ? closed[0].exit_date : null;

      setStats((prev) => ({
        ...prev,
        [setupId]: { winrate, wins, losses, ops, profitNeto, lastUsed },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar stats";
      setStats((prev) => ({
        ...prev,
        [setupId]: {
          winrate: null,
          wins: 0,
          losses: 0,
          ops: 0,
          profitNeto: 0,
          lastUsed: null,
          error: msg,
        },
      }));
    }
  };

  const sortedSetups = useMemo(() => {
    return [...setups].sort((a, b) => a.name.localeCompare(b.name));
  }, [setups]);

  if (loading) {
    return <div className="text-slate-400 p-4">Cargando setups...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Playbook</h2>
          <p className="text-sm text-slate-400">Tus setups con KPIs y detalles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Crear Setup
          </button>
          <button
            onClick={() => void fetchSetups()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
          >
            Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-800 bg-red-900/20 text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedSetups.length === 0 ? (
          <div className="col-span-full p-4 rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
            No hay setups creados. Crea uno para comenzar.
          </div>
        ) : (
          sortedSetups.map((setup) => {
            const stat = stats[setup.id];
            return (
              <div
                key={setup.id}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-50">
                    {setup.name}
                  </h3>
                  {setup.description && (
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {setup.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-400">Winrate</div>
                    <div className="text-slate-50 font-semibold">
                      {stat?.loading ? "..." : stat?.winrate != null ? `${stat.winrate}%` : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-400">Ops</div>
                    <div className="text-slate-50 font-semibold">
                      {stat?.loading ? "..." : stat?.ops ?? 0}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-xs text-slate-400">Profit</div>
                    <div className={`font-semibold ${(stat?.profitNeto ?? 0) >= 0 ? "text-green-300" : "text-red-300"}`}>
                      {stat?.loading ? "..." : formatCurrency(stat?.profitNeto ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400 mb-2">
                    Last used: {formatDate(stat?.lastUsed)}
                  </div>
                  {stat?.error && (
                    <div className="text-xs text-red-300 mb-2">{stat.error}</div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedSetupId(setup.id);
                    setSelectedSetupName(setup.name);
                  }}
                  className="w-full px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  Detalles
                </button>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <CreateSetupModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            void fetchSetups();
          }}
        />
      )}

      {selectedSetupId && (
        <SetupDetailsModal
          open={!!selectedSetupId}
          setupId={selectedSetupId}
          setupName={selectedSetupName}
          onClose={() => setSelectedSetupId(null)}
        />
      )}
    </div>
  );
}

