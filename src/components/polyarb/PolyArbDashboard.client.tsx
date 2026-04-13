"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CircleDot,
  Clock,
  Cpu,
  Pause,
  Play,
  Radio,
  Square,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "ERROR";
  starting_capital_usd: number;
  last_heartbeat_at: string | null;
  config: Record<string, unknown>;
}

interface Telemetry {
  equity_usd: number;
  available_balance_usd: number;
  open_positions_count: number;
  total_pnl_usd: number;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe_ratio: number | null;
  max_drawdown_pct: number | null;
  loop_latency_ms: number;
  ws_binance_connected: boolean;
  ws_polymarket_connected: boolean;
  btc_spot_price: number | null;
  consecutive_wins: number;
  consecutive_losses: number;
  last_signal: Record<string, unknown> | null;
  error_count_1h: number;
  last_heartbeat_at: string;
}

interface Position {
  id: string;
  market_slug: string;
  outcome: string;
  side: string;
  entry_price: number;
  size_usd: number;
  pnl_usd: number | null;
  pnl_percent: number | null;
  status: string;
  opened_at: string;
}

interface CBEvent {
  id: string;
  trigger_type: string;
  severity: string;
  detail: string;
  action_taken: string;
  created_at: string;
}

interface EquityPoint {
  equity_usd: number;
  pnl_usd: number;
  snapshot_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-green-500",
  STOPPED: "bg-gray-400",
  PAUSED: "bg-yellow-500",
  ERROR: "bg-red-500",
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals);
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const prefix = n >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(n).toFixed(2)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PolyArbDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [cbEvents, setCbEvents] = useState<CBEvent[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Clock tick for live "time ago"
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  void now; // used implicitly via timeAgo re-render

  // Fetch agents
  useEffect(() => {
    fetch("/api/polyarb/agents")
      .then((r) => r.json())
      .then((data: Agent[]) => {
        setAgents(data);
        if (data.length > 0) setActiveAgent(data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch data when active agent changes
  const fetchData = useCallback(async () => {
    if (!activeAgent) return;

    const [telRes, posRes, cbRes, eqRes] = await Promise.allSettled([
      fetch("/api/polyarb/telemetry").then((r) => r.json()),
      fetch("/api/polyarb/positions?status=open").then((r) => r.json()),
      fetch("/api/polyarb/circuit-breaker?limit=10").then((r) => r.json()),
      fetch("/api/polyarb/telemetry/history?days=7").then((r) => r.json()),
    ]);

    if (telRes.status === "fulfilled") setTelemetry(telRes.value);
    if (posRes.status === "fulfilled") setPositions(posRes.value.data ?? []);
    if (cbRes.status === "fulfilled") setCbEvents(cbRes.value ?? []);
    if (eqRes.status === "fulfilled") setEquityCurve(eqRes.value ?? []);
  }, [activeAgent]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const sendCommand = async (action: "start" | "stop" | "pause" | "resume") => {
    if (!activeAgent) return;
    try {
      const res = await fetch("/api/polyarb/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activeAgent.id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Agent ${action}ed`);
        setActiveAgent((a) => (a ? { ...a, status: data.status } : a));
      } else {
        toast.error(data.error || "Command failed");
      }
    } catch {
      toast.error("Failed to send command");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-zinc-400">Loading PolyArb...</div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Activity className="w-12 h-12 text-zinc-500" />
        <p className="text-zinc-400">No PolyArb agents configured yet.</p>
      </div>
    );
  }

  const pnl = telemetry?.total_pnl_usd ?? 0;
  const startCap = activeAgent?.starting_capital_usd ?? 50;
  const pnlPct = (pnl / startCap) * 100;

  // Polymarket "connected" = agente tiene heartbeat reciente (< 30s)
  const heartbeatMs = telemetry?.last_heartbeat_at
    ? Date.now() - new Date(telemetry.last_heartbeat_at).getTime()
    : Infinity;
  const polymarketActive = heartbeatMs < 30_000;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">{activeAgent?.name ?? "PolyArb Agent"}</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${STATUS_COLORS[activeAgent?.status ?? "STOPPED"]}`}>
            <CircleDot className="w-3 h-3" />
            {activeAgent?.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sendCommand("start")} disabled={activeAgent?.status === "RUNNING"}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            <Play className="w-3 h-3" /> Start
          </button>
          <button onClick={() => sendCommand("pause")} disabled={activeAgent?.status !== "RUNNING"}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            <Pause className="w-3 h-3" /> Pause
          </button>
          <button onClick={() => sendCommand("stop")} disabled={activeAgent?.status === "STOPPED"}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      </div>

      {/* ── Métricas principales ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Equity" value={`$${fmt(telemetry?.equity_usd)}`} sub={null} />
        <MetricCard label="P&L" value={fmtUsd(pnl)} sub={`${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 1)}%`} positive={pnl >= 0} />
        <MetricCard label="Win Rate" value={telemetry?.win_rate ? `${fmt(telemetry.win_rate, 1)}%` : "—"} sub={null} />
        <MetricCard label="Max Drawdown" value={telemetry?.max_drawdown_pct ? `${fmt(telemetry.max_drawdown_pct, 1)}%` : "—"} sub={null} />
      </div>

      {/* ── Métricas secundarias ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Profit Factor" value={telemetry?.profit_factor ? fmt(telemetry.profit_factor) : "—"} sub={null} />
        <MetricCard label="Sharpe Ratio" value={telemetry?.sharpe_ratio ? fmt(telemetry.sharpe_ratio) : "—"} sub={null} />
        <MetricCard label="Open Positions" value={String(telemetry?.open_positions_count ?? 0)} sub={null} />
        <MetricCard label="Errors (1h)" value={String(telemetry?.error_count_1h ?? 0)} sub={null} positive={(telemetry?.error_count_1h ?? 0) === 0} />
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <StatusPill icon={<Wifi className="w-3 h-3" />} label="Binance" active={telemetry?.ws_binance_connected ?? false} activeLabel="Live" inactiveLabel="Off" />
        <StatusPill icon={<Radio className="w-3 h-3" />} label="Polymarket" active={polymarketActive} activeLabel="REST" inactiveLabel="Off" />
        <StatusPill icon={<Cpu className="w-3 h-3" />} label="Loop" active={true} activeLabel={`${telemetry?.loop_latency_ms ?? 0}ms`} inactiveLabel="—" />
        <StatusPill icon={<Zap className="w-3 h-3" />} label="BTC" active={true} activeLabel={`$${fmt(telemetry?.btc_spot_price, 0)}`} inactiveLabel="—" />
        <StatusPill icon={<TrendingUp className="w-3 h-3" />} label="Streak"
          active={(telemetry?.consecutive_wins ?? 0) > 0}
          activeLabel={`${telemetry?.consecutive_wins ?? 0}W`}
          inactiveLabel={`${telemetry?.consecutive_losses ?? 0}L`} />
        <StatusPill icon={<Clock className="w-3 h-3" />} label="Heartbeat" active={heartbeatMs < 30_000} activeLabel={timeAgo(telemetry?.last_heartbeat_at ?? null)} inactiveLabel="Stale" />
      </div>

      {/* ── Última señal ────────────────────────────────────────────────── */}
      {telemetry?.last_signal && (
        <div className="bg-zinc-800/40 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Última Señal
          </h2>
          <pre className="text-xs text-zinc-400 overflow-x-auto">
            {JSON.stringify(telemetry.last_signal, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Equity Curve ────────────────────────────────────────────────── */}
      {equityCurve.length > 1 ? (
        <div className="bg-zinc-800/40 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Equity Curve (7d)
          </h2>
          <EquityChart data={equityCurve} startingCapital={startCap} />
        </div>
      ) : (
        <div className="bg-zinc-800/40 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Equity Curve (7d)
          </h2>
          <p className="text-xs text-zinc-600">Aún no hay snapshots. El primer punto aparece a los 60s del primer ciclo.</p>
        </div>
      )}

      {/* ── Open Positions ──────────────────────────────────────────────── */}
      <div className="bg-zinc-800/40 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">
          Open Positions ({positions.length})
        </h2>
        {positions.length === 0 ? (
          <p className="text-xs text-zinc-500">No open positions — el agente está en paper trading observando mercados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-zinc-500 border-b border-zinc-700">
                <tr>
                  <th className="pb-2 pr-4">Market</th>
                  <th className="pb-2 pr-4">Side</th>
                  <th className="pb-2 pr-4">Entry</th>
                  <th className="pb-2 pr-4">Size</th>
                  <th className="pb-2">P&L</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {positions.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800">
                    <td className="py-2 pr-4 truncate max-w-[200px]">{p.market_slug}</td>
                    <td className="py-2 pr-4">
                      <span className={p.outcome === "YES" ? "text-green-400" : "text-red-400"}>{p.outcome}</span>
                    </td>
                    <td className="py-2 pr-4">{fmt(p.entry_price, 4)}</td>
                    <td className="py-2 pr-4">${fmt(p.size_usd)}</td>
                    <td className="py-2">
                      {p.pnl_usd !== null ? (
                        <span className={p.pnl_usd >= 0 ? "text-green-400" : "text-red-400"}>{fmtUsd(p.pnl_usd)}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Circuit Breaker Events ──────────────────────────────────────── */}
      {cbEvents.length > 0 && (
        <div className="bg-zinc-800/40 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Circuit Breaker Events
          </h2>
          <div className="space-y-2">
            {cbEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-xs bg-zinc-900/50 rounded px-3 py-2">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded font-medium ${
                  e.severity === "S1" ? "bg-red-900 text-red-300"
                  : e.severity === "S2" ? "bg-yellow-900 text-yellow-300"
                  : "bg-zinc-700 text-zinc-300"
                }`}>
                  {e.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-300 font-medium">{e.trigger_type.replace(/_/g, " ")}</span>
                  <span className="text-zinc-500 ml-2">{e.detail}</span>
                </div>
                <span className="text-zinc-600 whitespace-nowrap">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Config del agente ───────────────────────────────────────────── */}
      {activeAgent?.config && (
        <div className="bg-zinc-800/40 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" /> Parámetros del Agente
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Loop", `${activeAgent.config.loop_interval_ms ?? 250}ms`],
              ["Min Edge", `${((activeAgent.config.min_edge_percent as number ?? 0.005) * 100).toFixed(2)}%`],
              ["Max Kelly", `${((activeAgent.config.max_kelly_fraction as number ?? 0.5) * 100).toFixed(0)}%`],
              ["Max Leverage", `${activeAgent.config.max_leverage ?? 3}x`],
              ["Daily DD Limit", `${((activeAgent.config.daily_drawdown_limit as number ?? -0.35) * 100).toFixed(0)}%`],
              ["Max Slippage", `${((activeAgent.config.max_slippage as number ?? 0.015) * 100).toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="bg-zinc-900/50 rounded px-3 py-2">
                <div className="text-zinc-500">{label}</div>
                <div className="text-zinc-200 font-mono font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, positive }: {
  label: string; value: string; sub: string | null; positive?: boolean;
}) {
  return (
    <div className="bg-zinc-800/60 rounded-lg px-4 py-3">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      {sub && (
        <div className={`text-xs mt-0.5 flex items-center gap-0.5 ${
          positive === undefined ? "text-zinc-400" : positive ? "text-green-400" : "text-red-400"
        }`}>
          {positive !== undefined && (positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
          {sub}
        </div>
      )}
    </div>
  );
}

function StatusPill({ icon, label, active, activeLabel, inactiveLabel }: {
  icon: React.ReactNode; label: string; active: boolean; activeLabel: string; inactiveLabel: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${active ? "bg-zinc-800/60" : "bg-zinc-900/40"}`}>
      <span className={active ? "text-green-400" : "text-red-400"}>{icon}</span>
      <div className="min-w-0">
        <div className="text-zinc-500">{label}</div>
        <div className={`font-mono font-medium truncate ${active ? "text-zinc-200" : "text-zinc-500"}`}>
          {active ? activeLabel : inactiveLabel}
        </div>
      </div>
    </div>
  );
}

function EquityChart({ data, startingCapital }: { data: EquityPoint[]; startingCapital: number }) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.equity_usd);
  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;
  const range = max - min || 1;
  const width = 600;
  const height = 120;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.equity_usd - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const lastValue = values[values.length - 1];
  const isUp = lastValue >= startingCapital;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
      <line
        x1={0} y1={height - ((startingCapital - min) / range) * height}
        x2={width} y2={height - ((startingCapital - min) / range) * height}
        stroke="#52525b" strokeWidth={0.5} strokeDasharray="4,4"
      />
      <polyline points={points} fill="none" stroke={isUp ? "#22c55e" : "#ef4444"} strokeWidth={1.5} />
    </svg>
  );
}
