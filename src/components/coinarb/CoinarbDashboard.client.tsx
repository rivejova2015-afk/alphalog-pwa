"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  Coins,
  CircleDot,
  Cpu,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "ERROR";
  starting_capital_usd: number | null;
  last_heartbeat_at: string | null;
  config: Record<string, unknown>;
  fly_instance_id: string | null;
}

interface Telemetry {
  agent_id: string;
  equity_usd: number | null;
  available_balance_usd: number | null;
  open_positions_count: number | null;
  total_pnl_usd: number | null;
  win_rate: number | null;
  max_drawdown_pct: number | null;
  loop_latency_ms: number | null;
  ws_binance_connected: boolean | null;
  ws_polymarket_connected: boolean | null;
  consecutive_wins: number | null;
  consecutive_losses: number | null;
  error_count_1h: number | null;
  last_heartbeat_at: string;
  last_signal: Record<string, unknown> | null;
}

interface Position {
  id: string;
  venue: string;
  symbol: string;
  side: string;
  outcome: string;
  entry_price: number | null;
  exit_price: number | null;
  size_usd: number | null;
  shares: number | null;
  pnl_usd: number | null;
  pnl_percent: number | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
}

interface Trade {
  id: string;
  trade_type: string;
  venue: string;
  symbol: string;
  side: string;
  price: number;
  size: number;
  size_usd: number | null;
  fee_usd: number | null;
  pnl_usd: number | null;
  status: string;
  executed_at: string;
}

const REFRESH_MS = 5000;

export default function CoinarbDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, pRes, trRes] = await Promise.all([
        fetch("/api/coinarb/telemetry", { cache: "no-store" }),
        fetch("/api/coinarb/positions?status=open&limit=20", { cache: "no-store" }),
        fetch("/api/coinarb/trades?limit=25", { cache: "no-store" }),
      ]);

      if (tRes.ok) {
        const body = await tRes.json();
        setAgent(body.agent ?? null);
        setTelemetry(body.telemetry ?? null);
      } else if (tRes.status === 404) {
        setAgent(null);
        setTelemetry(null);
      }

      if (pRes.ok) {
        const body = await pRes.json();
        setPositions(body.data ?? []);
      }

      if (trRes.ok) {
        const body = await trRes.json();
        setTrades(body.data ?? []);
      }
    } catch (err) {
      console.error("[coinarb] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const refresh = setInterval(fetchAll, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [fetchAll]);

  const createAgent = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/coinarb/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Coinarb 50x", starting_capital_usd: 100 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast.success("Coinarb agent provisioned");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="text-center py-20 text-[#475569] font-mono text-sm">
        <Cpu size={24} className="mx-auto mb-3 animate-pulse" />
        Loading Coinarb…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="bg-[#0c1220] border border-dashed border-[#1f2937] rounded-lg p-10 text-center">
        <Bitcoin size={32} className="text-[#f7931a] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#e2e8f0] font-mono mb-2">Coinarb 50x not provisioned</h2>
        <p className="text-sm text-[#94a3b8] mb-6">
          Cross-venue Coinbase trading bot (spot + perps). $100 starting capital, paper-mode by default.
        </p>
        <button
          type="button"
          onClick={createAgent}
          disabled={creating}
          className="px-5 py-2 rounded-md bg-[#f7931a]/15 border border-[#f7931a]/40 text-[#f7931a] font-mono text-sm font-bold hover:bg-[#f7931a]/25 disabled:opacity-50"
        >
          {creating ? "Provisioning…" : "Provision Coinarb Agent"}
        </button>
        <p className="text-[10px] text-[#475569] mt-4">
          Creates a row in <code className="text-[#22d3ee]">coinarb_agents</code>. Then set{" "}
          <code className="text-[#22d3ee]">COINARB_AGENT_ID</code> env in Fly.
        </p>
      </div>
    );
  }

  const heartbeatMs = telemetry?.last_heartbeat_at
    ? now - new Date(telemetry.last_heartbeat_at).getTime()
    : agent.last_heartbeat_at
      ? now - new Date(agent.last_heartbeat_at).getTime()
      : Infinity;
  const isLive = heartbeatMs < 30_000;
  const isPaper = agent.config?.paper_mode !== false;
  const startCap = Number(agent.starting_capital_usd ?? 0);
  const equity = telemetry?.equity_usd ?? startCap;
  const totalPnl = telemetry?.total_pnl_usd ?? 0;
  const pnlPct = startCap > 0 ? (totalPnl / startCap) * 100 : 0;

  const spotPositions = positions.filter((p) => p.venue === "spot");
  const perpPositions = positions.filter((p) => p.venue === "perp");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#0c1829] border border-[#f7931a]/30 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin size={18} className="text-[#f7931a]" />
              <h1 className="text-lg font-bold text-[#e2e8f0] font-mono">{agent.name}</h1>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  isPaper
                    ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50"
                    : "bg-red-900/40 text-red-400 border border-red-700/50"
                }`}
              >
                {isPaper ? "PAPER" : "LIVE"}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 ${
                  isLive
                    ? "bg-green-900/40 text-green-400 border border-green-700/50"
                    : "bg-[#1f2937] text-[#475569] border border-[#1f2937]"
                }`}
              >
                <CircleDot size={9} className={isLive ? "animate-pulse" : ""} />
                {isLive ? "LIVE" : agent.status}
              </span>
            </div>
            <div className="text-xs text-[#94a3b8] font-mono">
              Coinbase spot + INTX perps · Fly.io · agent_id <code className="text-[#22d3ee]">{agent.id.slice(0, 8)}</code>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="px-3 py-1.5 rounded text-xs font-mono text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1f2937] transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Equity" value={`$${equity.toFixed(2)}`} sub={`start $${startCap.toFixed(0)}`} color="#22d3ee" />
        <Kpi
          label="P&L Total"
          value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
          sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
          color={totalPnl >= 0 ? "#34d399" : "#ef4444"}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
        />
        <Kpi
          label="Open Positions"
          value={String(telemetry?.open_positions_count ?? positions.length)}
          sub={`${spotPositions.length} spot · ${perpPositions.length} perp`}
          color="#a78bfa"
        />
        <Kpi
          label="Drawdown"
          value={`${((telemetry?.max_drawdown_pct ?? 0) * 100).toFixed(2)}%`}
          sub={`win rate ${telemetry?.win_rate != null ? (telemetry.win_rate * 100).toFixed(1) + "%" : "—"}`}
          color={(telemetry?.max_drawdown_pct ?? 0) > 0.15 ? "#ef4444" : "#94a3b8"}
        />
      </div>

      {/* Health row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthTile
          label="Loop"
          value={telemetry?.loop_latency_ms != null ? `${telemetry.loop_latency_ms}ms` : "—"}
          ok={(telemetry?.loop_latency_ms ?? 0) < 500}
          icon={Activity}
        />
        <HealthTile
          label="Heartbeat"
          value={isLive ? `${Math.floor(heartbeatMs / 1000)}s ago` : "stale"}
          ok={isLive}
          icon={isLive ? Wifi : WifiOff}
        />
        <HealthTile
          label="Errors 1h"
          value={String(telemetry?.error_count_1h ?? 0)}
          ok={(telemetry?.error_count_1h ?? 0) === 0}
          icon={AlertTriangle}
        />
        <HealthTile
          label="Streak"
          value={`${telemetry?.consecutive_wins ?? 0}W / ${telemetry?.consecutive_losses ?? 0}L`}
          ok={(telemetry?.consecutive_losses ?? 0) < 3}
          icon={Zap}
        />
      </div>

      {/* Positions */}
      <Section title="Open Positions" icon={Coins} count={positions.length}>
        {positions.length === 0 ? (
          <Empty msg="No open positions" />
        ) : (
          <Table
            cols={["Venue", "Symbol", "Side", "Entry", "Size", "P&L"]}
            rows={positions.map((p) => [
              <VenuePill key="v" v={p.venue} />,
              <span key="s" className="font-mono text-[#e2e8f0]">{p.symbol}</span>,
              <SidePill key="sd" side={p.side} />,
              p.entry_price != null ? `$${Number(p.entry_price).toFixed(2)}` : "—",
              p.size_usd != null ? `$${Number(p.size_usd).toFixed(2)}` : "—",
              <PnL key="pn" value={p.pnl_usd} pct={p.pnl_percent} />,
            ])}
          />
        )}
      </Section>

      {/* Trades */}
      <Section title="Recent Trades" icon={Activity} count={trades.length}>
        {trades.length === 0 ? (
          <Empty msg="No trades yet" />
        ) : (
          <Table
            cols={["When", "Type", "Venue", "Symbol", "Side", "Price", "Size", "P&L"]}
            rows={trades.slice(0, 25).map((t) => [
              <span key="w" className="text-[10px] text-[#94a3b8]">
                {new Date(t.executed_at).toLocaleTimeString()}
              </span>,
              <TypePill key="tp" type={t.trade_type} />,
              <VenuePill key="v" v={t.venue} />,
              <span key="s" className="font-mono text-[#e2e8f0]">{t.symbol}</span>,
              <SidePill key="sd" side={t.side} />,
              `$${t.price.toFixed(2)}`,
              t.size_usd != null ? `$${t.size_usd.toFixed(2)}` : `${t.size}`,
              <PnL key="pn" value={t.pnl_usd} pct={null} />,
            ])}
          />
        )}
      </Section>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#475569]">{label}</span>
        {Icon && <Icon size={12} color={color} />}
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-[#475569] mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

function HealthTile({
  label,
  value,
  ok,
  icon: Icon,
}: {
  label: string;
  value: string;
  ok: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div
      className={`bg-[#151b28] border rounded-lg p-2.5 flex items-center gap-2 ${
        ok ? "border-[#1f2937]" : "border-red-700/40"
      }`}
    >
      <Icon size={14} className={ok ? "text-[#34d399]" : "text-[#ef4444]"} />
      <div className="flex-1">
        <div className="text-[10px] text-[#475569] uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono text-[#e2e8f0]">{value}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f2937] bg-[#0a0f1a]">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-[#22d3ee]" />
          <span className="text-xs font-bold text-[#e2e8f0] font-mono uppercase tracking-wider">{title}</span>
        </div>
        <span className="text-[10px] text-[#475569] font-mono">{count}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-6 text-xs text-[#475569] font-mono">{msg}</div>;
}

function Table({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1f2937]">
            {cols.map((c) => (
              <th key={c} className="text-left py-1.5 px-2 text-[10px] text-[#475569] uppercase tracking-wider font-mono">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1f2937]/50 hover:bg-[#151b28]/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-2 text-[#cbd5e1]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VenuePill({ v }: { v: string }) {
  const isSpot = v === "spot";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
        isSpot ? "bg-[#22d3ee]/15 text-[#22d3ee]" : "bg-[#a78bfa]/15 text-[#a78bfa]"
      }`}
    >
      {v}
    </span>
  );
}

function SidePill({ side }: { side: string }) {
  const isBuy = side === "BUY";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
        isBuy ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
      }`}
    >
      {side}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-[#1f2937] text-[#94a3b8]">
      {type}
    </span>
  );
}

function PnL({ value, pct }: { value: number | null; pct: number | null }) {
  if (value == null) return <span className="text-[#475569]">—</span>;
  const positive = value >= 0;
  return (
    <span className={`font-mono font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
      {positive ? "+" : ""}${value.toFixed(2)}
      {pct != null && (
        <span className="ml-1 text-[10px] opacity-70">
          ({positive ? "+" : ""}
          {Number(pct).toFixed(2)}%)
        </span>
      )}
    </span>
  );
}
