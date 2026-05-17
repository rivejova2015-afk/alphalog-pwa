"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  Coins,
  CircleDot,
  Cpu,
  Grid3x3,
  Layers,
  Network,
  RefreshCw,
  Target,
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
  ws_coinbase_connected: boolean | null;
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
  direction?: string | null;
  entry_price: number | null;
  exit_price: number | null;
  size_usd: number | null;
  base_qty: number | null;
  pnl_usd: number | null;
  pnl_percent: number | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  leverageUsed?: number;
  exitReason?: string | null;
  entryMeta?: Record<string, unknown>;
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
  slippage_bps: number | null;
  execution_latency_ms: number | null;
  status: string;
  executed_at: string;
}

interface Decision {
  id: string;
  kind: 'ENTER' | 'SCALP' | 'SKIP' | 'EXIT' | 'BREAKER' | 'CASCADE' | 'TICK';
  symbol: string | null;
  venue: 'spot' | null;
  reason: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

interface ExecutionStats {
  slippage: { p50: number; p95: number; max: number; count: number };
  latency: { p50: number; p95: number; max: number; count: number };
  fees: { totalUsd: number; count: number; avgUsd: number };
  fills: number;
}

interface PnlBucket { count: number; pnlUsd: number; winRate: number }
interface PnlStats {
  byVenue: Record<string, PnlBucket>;
  bySymbol: Array<{ symbol: string } & PnlBucket>;
  byTier: Record<string, PnlBucket>;
  cumulativeToday: Array<{ at: string; cumPnlUsd: number }>;
}

interface SkipReasons {
  window: string;
  total: number;
  byReason: Array<{ reason: string; count: number }>;
}

interface CalibrationStats {
  window: string;
  total: number;
  brier: number;
  reliability: Array<{ bin: number; predicted: number; actual: number; count: number }>;
  byRegime: Array<{ key: string; brier: number; winRate: number; count: number }>;
  byTier: Array<{ key: string; brier: number; winRate: number; count: number }>;
}

interface RegimePoint {
  capturedAt: string;
  regime: string;
  multiplier: number;
  trend: string | null;
  trendStrength: number;
  volatilityPct: number;
  consistencyScore: number;
  previousRegime: string | null;
  isTransition: boolean;
}
interface RegimeSnapshots {
  window: string;
  transitions: number;
  current: RegimePoint | null;
  points: RegimePoint[];
}

interface ExposureHeatmapData {
  venues: string[];
  symbols: string[];
  cells: Array<{ venue: string; symbol: string; side: 'BUY' | 'SELL'; count: number; notionalUsd: number }>;
  totalNotionalUsd: number;
}

interface CorrelationData {
  window: string;
  symbols: string[];
  matrix: number[][];
  days: number;
}

interface DrawdownPoint { at: string; equity: number; peak: number; ddPct: number }
interface DrawdownStats {
  window: string;
  points: DrawdownPoint[];
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  startCapital: number;
}

const PRICE_REFRESH_MS = 1000;
const TELEMETRY_REFRESH_MS = 5000;
const STATS_REFRESH_MS = 15_000;
const DECISIONS_REFRESH_MS = 3000;
const SKIP_REFRESH_MS = 60_000;
const PHASE2_REFRESH_MS = 30_000;
const SPARKLINE_LEN = 60;

export default function CoinarbDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [execStats, setExecStats] = useState<ExecutionStats | null>(null);
  const [pnlStats, setPnlStats] = useState<PnlStats | null>(null);
  const [skipReasons, setSkipReasons] = useState<SkipReasons | null>(null);
  const [decisionsPaused, setDecisionsPaused] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationStats | null>(null);
  const [regimeSnaps, setRegimeSnaps] = useState<RegimeSnapshots | null>(null);
  const [heatmap, setHeatmap] = useState<ExposureHeatmapData | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationData | null>(null);
  const [drawdown, setDrawdown] = useState<DrawdownStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchTelemetry = useCallback(async () => {
    try {
      const [tRes, trRes] = await Promise.all([
        fetch("/api/coinarb/telemetry", { cache: "no-store" }),
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
      if (trRes.ok) {
        const body = await trRes.json();
        setTrades(body.data ?? []);
      }
    } catch (err) {
      console.error("[coinarb] telemetry fetch failed", err);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/coinarb/positions?status=open&limit=20", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setPositions(body.data ?? []);
      }
    } catch (err) {
      console.error("[coinarb] positions fetch failed", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [eRes, pRes] = await Promise.all([
        fetch("/api/coinarb/stats/execution", { cache: "no-store" }),
        fetch("/api/coinarb/stats/pnl", { cache: "no-store" }),
      ]);
      if (eRes.ok) setExecStats(await eRes.json());
      if (pRes.ok) setPnlStats(await pRes.json());
    } catch (err) {
      console.error("[coinarb] stats fetch failed", err);
    }
  }, []);

  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch("/api/coinarb/decisions?limit=50", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setDecisions(body.data ?? []);
      }
    } catch (err) {
      console.error("[coinarb] decisions fetch failed", err);
    }
  }, []);

  const fetchSkipReasons = useCallback(async () => {
    try {
      const res = await fetch("/api/coinarb/decisions/skip-reasons", { cache: "no-store" });
      if (res.ok) setSkipReasons(await res.json());
    } catch (err) {
      console.error("[coinarb] skip-reasons fetch failed", err);
    }
  }, []);

  const fetchPhase2 = useCallback(async () => {
    try {
      const [c, r, h, cor, dd] = await Promise.all([
        fetch("/api/coinarb/stats/calibration", { cache: "no-store" }),
        fetch("/api/coinarb/stats/regime-snapshots", { cache: "no-store" }),
        fetch("/api/coinarb/stats/exposure-heatmap", { cache: "no-store" }),
        fetch("/api/coinarb/stats/correlation", { cache: "no-store" }),
        fetch("/api/coinarb/stats/drawdown", { cache: "no-store" }),
      ]);
      if (c.ok) setCalibration(await c.json());
      if (r.ok) setRegimeSnaps(await r.json());
      if (h.ok) setHeatmap(await h.json());
      if (cor.ok) setCorrelation(await cor.json());
      if (dd.ok) setDrawdown(await dd.json());
    } catch (err) {
      console.error("[coinarb] phase2 stats fetch failed", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchTelemetry(),
      fetchPositions(),
      fetchStats(),
      fetchDecisions(),
      fetchSkipReasons(),
      fetchPhase2(),
    ]).finally(() => setLoading(false));
  }, [fetchTelemetry, fetchPositions, fetchStats, fetchDecisions, fetchSkipReasons, fetchPhase2]);

  // Telemetry + trades refresh (5s)
  useEffect(() => {
    const id = setInterval(fetchTelemetry, TELEMETRY_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchTelemetry]);

  // Positions refresh — 1s when open positions exist (live sparkline + drawdown), else 5s
  const hasOpenPositions = positions.length > 0;
  useEffect(() => {
    const interval = hasOpenPositions ? PRICE_REFRESH_MS : TELEMETRY_REFRESH_MS;
    const id = setInterval(fetchPositions, interval);
    return () => clearInterval(id);
  }, [fetchPositions, hasOpenPositions]);

  // Now tick (1s) for relative time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Stats refresh (15s)
  useEffect(() => {
    const id = setInterval(fetchStats, STATS_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Decisions refresh (3s when not paused)
  useEffect(() => {
    if (decisionsPaused) return;
    const id = setInterval(fetchDecisions, DECISIONS_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchDecisions, decisionsPaused]);

  // Skip reasons refresh (60s)
  useEffect(() => {
    const id = setInterval(fetchSkipReasons, SKIP_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchSkipReasons]);

  // Phase 2 stats refresh (30s)
  useEffect(() => {
    const id = setInterval(fetchPhase2, PHASE2_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchPhase2]);

  // Derived live state per position
  const newPositionIds = useNewPositionFlash(positions);
  const priceHistory = usePriceSparkline(positions);
  const drawdowns = usePositionDrawdownMap(positions);
  const newDecisionIds = useNewDecisionFlash(decisions);

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
      await Promise.all([fetchTelemetry(), fetchPositions()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }, [fetchTelemetry, fetchPositions]);

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
            onClick={() => {
              fetchTelemetry();
              fetchPositions();
              fetchStats();
              fetchDecisions();
              fetchSkipReasons();
              fetchPhase2();
            }}
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

      {/* Risk: drawdown curve + exposure heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <DrawdownChart data={drawdown} />
        </div>
        <ExposureHeatmap data={heatmap} />
      </div>

      {/* Execution quality + cumulative pnl */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ExecutionQualityStrip stats={execStats} />
        </div>
        <CumulativePnlChart points={pnlStats?.cumulativeToday ?? []} />
      </div>

      {/* P&L breakdown */}
      <PnlBreakdownPanel stats={pnlStats} />

      {/* Calibration + correlation matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <CalibrationPanel stats={calibration} />
        </div>
        <CorrelationMatrix data={correlation} />
      </div>

      {/* Positions */}
      <Section title="Open Positions" icon={Coins} count={positions.length}>
        <CoinarbExposureBar positions={positions} agent={agent} telemetry={telemetry} />
        {positions.length === 0 ? (
          <Empty msg="No open positions" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {positions.map((p) => (
              <CoinarbPositionCard
                key={p.id}
                pos={p}
                isNew={newPositionIds.has(p.id)}
                worstPct={drawdowns.get(p.id) ?? 0}
                prices={priceHistory.get(p.id) ?? []}
                now={now}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Trades */}
      <Section title="Recent Trades" icon={Activity} count={trades.length}>
        {trades.length === 0 ? (
          <Empty msg="No trades yet" />
        ) : (
          <Table
            cols={["When", "Type", "Venue", "Symbol", "Side", "Price", "Size", "Slip", "Lat", "Fee", "P&L"]}
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
              <span key="slip" className="font-mono text-[10px] text-[#94a3b8]">
                {t.slippage_bps != null ? `${Math.abs(t.slippage_bps).toFixed(1)}bps` : "—"}
              </span>,
              <span key="lat" className="font-mono text-[10px] text-[#94a3b8]">
                {t.execution_latency_ms != null ? `${t.execution_latency_ms}ms` : "—"}
              </span>,
              <span key="fee" className="font-mono text-[10px] text-[#94a3b8]">
                {t.fee_usd != null ? `$${Number(t.fee_usd).toFixed(2)}` : "—"}
              </span>,
              <PnL key="pn" value={t.pnl_usd} pct={null} />,
            ])}
          />
        )}
      </Section>

      {/* Regime timeline */}
      <RegimeTimeline data={regimeSnaps} />

      {/* Decisions feed + skip reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <DecisionsFeed
            decisions={decisions}
            paused={decisionsPaused}
            onTogglePause={() => setDecisionsPaused((v) => !v)}
            newIds={newDecisionIds}
          />
        </div>
        <SkipReasonsPanel data={skipReasons} />
      </div>
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

// ─── Live position helpers ─────────────────────────────────────────────────

function impliedCurrentPrice(p: Position): number | null {
  if (p.entry_price == null || p.pnl_percent == null) return null;
  const dir = p.side === "BUY" ? 1 : -1;
  return p.entry_price * (1 + (dir * p.pnl_percent) / 100);
}

function formatElapsed(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function todayUtcKey(prefix: string): string {
  return `${prefix}:${new Date().toISOString().slice(0, 10)}`;
}

// Flashes newly added position IDs for 5s after first detection.
// Skips the first render so existing positions don't all flash on mount.
function useNewPositionFlash(positions: Position[]): Set<string> {
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentIds = new Set(positions.map((p) => p.id));
    if (seenRef.current === null) {
      seenRef.current = currentIds;
      return;
    }
    const newIds: string[] = [];
    for (const id of currentIds) {
      if (!seenRef.current.has(id)) newIds.push(id);
    }
    seenRef.current = currentIds;
    if (newIds.length === 0) return;

    setFlashing((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
    setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
    }, 5000);
  }, [positions]);

  return flashing;
}

// Maintains a rolling implied-price history per positionId (last SPARKLINE_LEN samples).
function usePriceSparkline(positions: Position[]): Map<string, number[]> {
  const [history, setHistory] = useState<Map<string, number[]>>(() => new Map());

  useEffect(() => {
    setHistory((prev) => {
      const next = new Map(prev);
      const seen = new Set<string>();
      let changed = false;
      for (const p of positions) {
        seen.add(p.id);
        const price = impliedCurrentPrice(p);
        if (price == null) continue;
        const arr = next.get(p.id) ?? [];
        if (arr[arr.length - 1] !== price) {
          const nextArr = arr.length >= SPARKLINE_LEN
            ? [...arr.slice(arr.length - SPARKLINE_LEN + 1), price]
            : [...arr, price];
          next.set(p.id, nextArr);
          changed = true;
        }
      }
      for (const id of Array.from(next.keys())) {
        if (!seen.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [positions]);

  return history;
}

// Tracks worst pnl_percent ever observed per position, persisted to localStorage.
// Auto-cleans up keys for positions no longer present.
function usePositionDrawdownMap(positions: Position[]): Map<string, number> {
  const [drawdowns, setDrawdowns] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    setDrawdowns((prev) => {
      const next = new Map<string, number>();
      const seen = new Set<string>();
      let changed = next.size !== prev.size;

      for (const p of positions) {
        seen.add(p.id);
        const key = `coinarb:dd:${p.id}`;
        let stored: number | null = null;
        try {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem(key);
            stored = raw != null ? Number(raw) : null;
          }
        } catch {}
        const prevWorst = prev.get(p.id) ?? stored ?? 0;
        const current = p.pnl_percent ?? 0;
        const worst = Math.min(prevWorst, current, 0);
        next.set(p.id, worst);
        if (worst !== prev.get(p.id)) changed = true;
        if (worst !== stored) {
          try {
            if (typeof window !== "undefined") window.localStorage.setItem(key, String(worst));
          } catch {}
        }
      }

      if (typeof window !== "undefined") {
        try {
          const toDelete: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (!k || !k.startsWith("coinarb:dd:")) continue;
            const id = k.slice("coinarb:dd:".length);
            if (!seen.has(id)) toDelete.push(k);
          }
          for (const k of toDelete) window.localStorage.removeItem(k);
        } catch {}
      }

      return changed ? next : prev;
    });
  }, [positions]);

  return drawdowns;
}

// ─── Live UI components ────────────────────────────────────────────────────

function MiniSparkline({ points, color = "#22d3ee" }: { points: number[]; color?: string }) {
  if (points.length < 2) {
    return <div className="w-[80px] h-[32px] flex items-center justify-end text-[9px] text-[#475569] font-mono">…</div>;
  }
  const W = 80;
  const H = 32;
  const sample = points.length > 32
    ? Array.from({ length: 32 }, (_, i) => points[Math.floor((i / 31) * (points.length - 1))])
    : points;
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const range = Math.max(max - min, 1e-9);
  const path = sample
    .map((y, i) => {
      const x = (i / (sample.length - 1)) * W;
      const yy = H - ((y - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.25} />
    </svg>
  );
}

function CoinarbPositionCard({
  pos,
  isNew,
  worstPct,
  prices,
  now,
}: {
  pos: Position;
  isNew: boolean;
  worstPct: number;
  prices: number[];
  now: number;
}) {
  const current = impliedCurrentPrice(pos);
  const deltaPct = pos.pnl_percent ?? 0;
  const deltaUsd = pos.pnl_usd ?? 0;
  const positive = deltaPct >= 0;
  const openedMs = pos.opened_at ? now - new Date(pos.opened_at).getTime() : 0;
  const meta = pos.entryMeta ?? {};
  const regime = typeof meta.regime === 'string' ? meta.regime : null;
  const tier = typeof meta.tier === 'string' ? meta.tier : null;
  const conf = typeof meta.validatorConfidence === 'number' ? meta.validatorConfidence : null;
  const slipBps = typeof meta.slippageBps === 'number' ? meta.slippageBps : null;
  const feeUsd = typeof meta.feeUsdEstimated === 'number' ? meta.feeUsdEstimated : null;
  const lev = pos.leverageUsed ?? null;
  const hasMeta = regime != null || tier != null || slipBps != null || feeUsd != null || lev != null;

  return (
    <div
      className={`bg-[#151b28] border rounded-lg p-3 transition-colors ${
        isNew
          ? "border-[#34d399] shadow-[0_0_0_1px_rgba(52,211,153,0.4)]"
          : "border-[#1f2937]"
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <VenuePill v={pos.venue} />
          <SidePill side={pos.side} />
          <span className="font-mono text-[12px] text-[#e2e8f0] truncate">{pos.symbol}</span>
        </div>
        {isNew && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40 animate-pulse">
            NUEVA
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-0.5">Entry → Now</div>
          <div className="font-mono text-[11px] text-[#cbd5e1] truncate">
            ${pos.entry_price?.toFixed(2) ?? "—"}
            <span className="mx-1 text-[#475569]">→</span>
            <span className={positive ? "text-green-400" : "text-red-400"}>
              {current != null ? `$${current.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className={`text-[10px] font-mono font-bold mt-0.5 ${positive ? "text-green-400" : "text-red-400"}`}>
            {positive ? "+" : ""}{deltaPct.toFixed(2)}% ({positive ? "+" : ""}${deltaUsd.toFixed(2)})
          </div>
        </div>
        <MiniSparkline points={prices} color={positive ? "#34d399" : "#ef4444"} />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1f2937]">
        <div>
          <div className="text-[9px] text-[#475569] uppercase tracking-wider">En riesgo</div>
          <div className="text-[11px] font-mono font-bold text-[#22d3ee]">
            ${pos.size_usd?.toFixed(2) ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#475569] uppercase tracking-wider">Drawdown</div>
          <div className={`text-[11px] font-mono font-bold ${worstPct < 0 ? "text-red-400" : "text-[#94a3b8]"}`}>
            {worstPct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#475569] uppercase tracking-wider">Tiempo</div>
          <div className="text-[11px] font-mono text-[#94a3b8]">{formatElapsed(openedMs)}</div>
        </div>
      </div>

      {hasMeta && (
        <div className="mt-2 pt-2 border-t border-[#1f2937]/60 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono text-[#94a3b8]">
          {regime && <span className="px-1.5 py-0.5 rounded bg-[#0a0f1a] border border-[#1f2937] text-[#22d3ee]">{regime}</span>}
          {tier && <span className="px-1.5 py-0.5 rounded bg-[#0a0f1a] border border-[#1f2937] text-[#a78bfa]">{tier}</span>}
          {conf != null && <span>conf {(conf * 100).toFixed(0)}%</span>}
          {slipBps != null && <span>slip {Math.abs(slipBps).toFixed(1)}bps</span>}
          {feeUsd != null && <span>fee ${feeUsd.toFixed(2)}</span>}
          {lev != null && lev !== 1 && <span>lev {lev.toFixed(1)}x</span>}
        </div>
      )}
    </div>
  );
}

function CoinarbExposureBar({
  positions,
  agent,
  telemetry,
}: {
  positions: Position[];
  agent: Agent;
  telemetry: Telemetry | null;
}) {
  const totalNotional = positions.reduce((sum, p) => sum + (p.size_usd ?? 0), 0);
  const capitalAtRisk = totalNotional;
  const cfg = agent.config as Record<string, unknown>;
  const dailyCap = Number(cfg?.daily_trade_cap ?? cfg?.dailyTradeCap ?? 7);
  const openCount = positions.length;

  const peakKey = todayUtcKey("coinarb:peak");
  const [peak, setPeak] = useState<number>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored = 0;
    try {
      const raw = window.localStorage.getItem(peakKey);
      stored = raw != null ? Number(raw) : 0;
    } catch {}
    const next = Math.max(stored, totalNotional);
    if (next > stored) {
      try { window.localStorage.setItem(peakKey, String(next)); } catch {}
    }
    setPeak(next);
  }, [totalNotional, peakKey]);

  const baseKey = todayUtcKey("coinarb:pnl-base");
  const [pnlDay, setPnlDay] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const total = telemetry?.total_pnl_usd ?? null;
    if (total == null) {
      setPnlDay(null);
      return;
    }
    let base: number;
    try {
      const raw = window.localStorage.getItem(baseKey);
      if (raw == null) {
        base = total;
        window.localStorage.setItem(baseKey, String(total));
      } else {
        base = Number(raw);
      }
    } catch {
      base = total;
    }
    setPnlDay(total - base);
  }, [telemetry?.total_pnl_usd, baseKey]);

  const pnlDayPositive = pnlDay != null && pnlDay >= 0;

  return (
    <div className="bg-[#0a0f1a] border border-[#1f2937] rounded p-2.5 grid grid-cols-2 md:grid-cols-5 gap-2">
      <ExposureMetric label="Notional" value={`$${totalNotional.toFixed(2)}`} color="#22d3ee" />
      <ExposureMetric label="En riesgo" value={`$${capitalAtRisk.toFixed(2)}`} color="#a78bfa" />
      <ExposureMetric
        label="P&L día"
        value={pnlDay != null ? `${pnlDayPositive ? "+" : ""}$${pnlDay.toFixed(2)}` : "—"}
        color={pnlDay == null ? "#475569" : pnlDayPositive ? "#34d399" : "#ef4444"}
      />
      <ExposureMetric label="Peak today" value={`$${peak.toFixed(2)}`} color="#94a3b8" />
      <ExposureMetric
        label="Open / cap"
        value={`${openCount} / ${dailyCap}`}
        color={openCount >= dailyCap ? "#ef4444" : "#94a3b8"}
      />
    </div>
  );
}

function ExposureMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] text-[#475569] uppercase tracking-wider">{label}</div>
      <div className="text-[12px] font-mono font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

// ─── New Phase 1 panels ────────────────────────────────────────────────────

function useNewDecisionFlash(decisions: Decision[]): Set<string> {
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ids = new Set(decisions.map((d) => d.id));
    if (seenRef.current === null) {
      seenRef.current = ids;
      return;
    }
    const fresh: string[] = [];
    for (const id of ids) {
      if (!seenRef.current.has(id)) fresh.push(id);
    }
    seenRef.current = ids;
    if (fresh.length === 0) return;

    setFlashing((prev) => {
      const next = new Set(prev);
      for (const id of fresh) next.add(id);
      return next;
    });
    setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.delete(id);
        return next;
      });
    }, 2000);
  }, [decisions]);

  return flashing;
}

function ExecutionQualityStrip({ stats }: { stats: ExecutionStats | null }) {
  const slipP95 = stats?.slippage.p95 ?? 0;
  const latP95 = stats?.latency.p95 ?? 0;
  const slipBad = slipP95 >= 20;
  const latBad = latP95 >= 500;
  const tone = slipBad && latBad ? "border-red-700/50" : (slipBad || latBad ? "border-yellow-700/50" : "border-[#1f2937]");

  return (
    <div className={`bg-[#0a0f1a] border ${tone} rounded p-2.5 h-full`}>
      <div className="flex items-center gap-2 mb-2">
        <Activity size={12} className="text-[#22d3ee]" />
        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider font-mono">
          Execution quality (today UTC)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ExposureMetric
          label="Slip p95"
          value={stats ? `${slipP95.toFixed(1)}bps` : "—"}
          color={slipBad ? "#ef4444" : "#34d399"}
        />
        <ExposureMetric
          label="Latency p95"
          value={stats ? `${latP95}ms` : "—"}
          color={latBad ? "#ef4444" : "#34d399"}
        />
        <ExposureMetric
          label="Fees today"
          value={stats ? `$${stats.fees.totalUsd.toFixed(2)}` : "—"}
          color="#a78bfa"
        />
        <ExposureMetric
          label="Fills"
          value={stats ? String(stats.fills) : "—"}
          color="#94a3b8"
        />
      </div>
    </div>
  );
}

function CumulativePnlChart({ points }: { points: Array<{ at: string; cumPnlUsd: number }> }) {
  if (points.length < 2) {
    return (
      <div className="bg-[#0a0f1a] border border-[#1f2937] rounded p-2.5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={12} className="text-[#22d3ee]" />
          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider font-mono">Cumulative P&amp;L (today)</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[10px] text-[#475569] font-mono">
          Sin cierres hoy
        </div>
      </div>
    );
  }
  const W = 320;
  const H = 64;
  const ys = points.map((p) => p.cumPnlUsd);
  const min = Math.min(0, ...ys);
  const max = Math.max(0, ...ys);
  const range = Math.max(max - min, 1e-9);
  const last = ys[ys.length - 1];
  const positive = last >= 0;
  const stroke = positive ? "#34d399" : "#ef4444";
  const fillId = positive ? "coinarbPnlPos" : "coinarbPnlNeg";
  const yToPx = (y: number) => H - ((y - min) / range) * H;
  const zeroY = yToPx(0);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yToPx(p.cumPnlUsd).toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${W},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;

  return (
    <div className="bg-[#0a0f1a] border border-[#1f2937] rounded p-2.5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={12} className="text-[#22d3ee]" />
          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider font-mono">
            Cumulative P&amp;L (today)
          </span>
        </div>
        <span className={`text-[11px] font-mono font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
          {positive ? "+" : ""}${last.toFixed(2)}
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="#1f2937" strokeDasharray="2 3" />
        <path d={area} fill={`url(#${fillId})`} />
        <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
      </svg>
      <div className="text-[9px] text-[#475569] font-mono mt-1">
        {points.length} cierre{points.length === 1 ? "" : "s"} · día UTC
      </div>
    </div>
  );
}

function PnlBreakdownPanel({ stats }: { stats: PnlStats | null }) {
  const venues = stats ? Object.entries(stats.byVenue) : [];
  const tiers = stats ? Object.entries(stats.byTier) : [];
  const symbols = stats?.bySymbol ?? [];
  const empty = !stats || (venues.length === 0 && tiers.length === 0 && symbols.length === 0);

  return (
    <Section title="P&L Breakdown" icon={Coins} count={symbols.length + venues.length + tiers.length}>
      {empty ? (
        <Empty msg="Sin trades cerrados" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PnlGroup title="By Venue" rows={venues.map(([k, v]) => ({ label: k.toUpperCase(), ...v }))} />
          <PnlGroup title="By Symbol" rows={symbols.map(({ symbol, count, pnlUsd, winRate }) => ({ label: symbol, count, pnlUsd, winRate }))} />
          <PnlGroup title="By Tier" rows={tiers.map(([k, v]) => ({ label: k, ...v }))} />
        </div>
      )}
    </Section>
  );
}

function PnlGroup({ title, rows }: { title: string; rows: Array<{ label: string; count: number; pnlUsd: number; winRate: number }> }) {
  return (
    <div className="bg-[#0a0f1a] border border-[#1f2937] rounded p-2.5">
      <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider font-mono mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-[10px] text-[#475569] font-mono">—</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const positive = r.pnlUsd >= 0;
            return (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#cbd5e1]">{r.label}</span>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className={`font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
                    {positive ? "+" : ""}${r.pnlUsd.toFixed(2)}
                  </span>
                  <span className="text-[#94a3b8]">{(r.winRate * 100).toFixed(0)}%</span>
                  <span className="text-[#475569]">n={r.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecisionsFeed({
  decisions,
  paused,
  onTogglePause,
  newIds,
}: {
  decisions: Decision[];
  paused: boolean;
  onTogglePause: () => void;
  newIds: Set<string>;
}) {
  const slice = decisions.slice(0, 50);
  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f2937] bg-[#0a0f1a]">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-[#22d3ee]" />
          <span className="text-xs font-bold text-[#e2e8f0] font-mono uppercase tracking-wider">
            Decisions feed
          </span>
          <span className="text-[10px] text-[#475569] font-mono">{slice.length}</span>
        </div>
        <button
          type="button"
          onClick={onTogglePause}
          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border transition-colors ${
            paused
              ? "border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20"
              : "border-[#1f2937] text-[#94a3b8] hover:bg-[#1f2937]"
          }`}
        >
          {paused ? "PAUSED" : "LIVE"}
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {slice.length === 0 ? (
          <Empty msg="Sin decisiones aún" />
        ) : (
          <ul className="divide-y divide-[#1f2937]/60">
            {slice.map((d) => (
              <DecisionRow key={d.id} d={d} fresh={newIds.has(d.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DecisionRow({ d, fresh }: { d: Decision; fresh: boolean }) {
  const colors: Record<Decision["kind"], string> = {
    ENTER: "bg-green-900/30 text-green-400 border-green-700/40",
    SCALP: "bg-[#22d3ee]/15 text-[#22d3ee] border-[#22d3ee]/30",
    EXIT: "bg-blue-900/30 text-blue-300 border-blue-700/40",
    SKIP: "bg-[#1f2937] text-[#94a3b8] border-[#1f2937]",
    BREAKER: "bg-red-900/40 text-red-400 border-red-700/40",
    CASCADE: "bg-purple-900/30 text-purple-300 border-purple-700/40",
    TICK: "bg-[#0a0f1a] text-[#475569] border-[#1f2937]",
  };
  const t = new Date(d.createdAt).toLocaleTimeString();

  return (
    <li
      className={`px-3 py-1.5 flex items-start gap-2 text-[11px] font-mono transition-colors ${
        fresh ? "bg-[#34d399]/10" : "hover:bg-[#151b28]/50"
      }`}
    >
      <span className="text-[10px] text-[#475569] w-[68px] shrink-0">{t}</span>
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${colors[d.kind] ?? colors.TICK}`}>
        {d.kind}
      </span>
      {d.venue && <span className="text-[#94a3b8] shrink-0">{d.venue}</span>}
      {d.symbol && <span className="text-[#cbd5e1] shrink-0">{d.symbol}</span>}
      <span className="text-[#94a3b8] truncate">{d.reason}</span>
    </li>
  );
}

function SkipReasonsPanel({ data }: { data: SkipReasons | null }) {
  const top = (data?.byReason ?? []).slice(0, 6);
  const remainder = (data?.byReason.length ?? 0) - top.length;
  const max = top.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f2937] bg-[#0a0f1a]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#f7931a]" />
          <span className="text-xs font-bold text-[#e2e8f0] font-mono uppercase tracking-wider">
            Skip reasons (24h)
          </span>
        </div>
        <span className="text-[10px] text-[#475569] font-mono">{data?.total ?? 0}</span>
      </div>
      <div className="p-3 flex-1">
        {top.length === 0 ? (
          <Empty msg="Sin SKIPs en 24h" />
        ) : (
          <div className="space-y-2">
            {top.map((r) => {
              const w = max > 0 ? (r.count / max) * 100 : 0;
              return (
                <div key={r.reason} title={`${r.count} skips`}>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-[#cbd5e1] truncate">{r.reason}</span>
                    <span className="text-[#94a3b8] tabular-nums">{r.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#0a0f1a] border border-[#1f2937] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#f7931a]/60"
                      style={{ width: `${w.toFixed(1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {remainder > 0 && (
              <div className="text-[9px] text-[#475569] font-mono pt-1">+{remainder} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 2: Risk + Calibration + Regime ──────────────────────────────────

const REGIME_COLORS: Record<string, string> = {
  CALM:     "#22d3ee",
  TRENDING: "#34d399",
  VOLATILE: "#facc15",
  CRISIS:   "#ef4444",
  UNKNOWN:  "#475569",
};

function DrawdownChart({ data }: { data: DrawdownStats | null }) {
  const points = data?.points ?? [];
  const w = 320;
  const h = 88;
  const pad = 4;

  const body = (() => {
    if (points.length < 2) {
      return (
        <div className="h-[88px] flex items-center justify-center text-[10px] text-[#475569] font-mono">
          {data && data.startCapital === 0 ? "Sin starting capital" : "Sin cierres aún"}
        </div>
      );
    }
    const maxDd = Math.max(0.001, ...points.map(p => p.ddPct));
    const path = points
      .map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = pad + (p.ddPct / maxDd) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
    const area = `${path} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[88px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dd-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d={area} fill="url(#dd-grad)" />
        <path d={path} fill="none" stroke="#ef4444" strokeWidth="1.4" />
      </svg>
    );
  })();

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown size={11} className="text-[#ef4444]" />
          <h3 className="text-[10px] font-bold text-[#94a3b8] font-mono uppercase tracking-wide">Equity Underwater</h3>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#94a3b8]">
          <span>cur <span className="text-[#ef4444]">{((data?.currentDrawdownPct ?? 0) * 100).toFixed(2)}%</span></span>
          <span>max <span className="text-[#ef4444]">{((data?.maxDrawdownPct ?? 0) * 100).toFixed(2)}%</span></span>
          <span className="text-[#475569]">{data?.window ?? "14d"}</span>
        </div>
      </div>
      {body}
      <div className="text-[9px] text-[#475569] font-mono pt-1.5 text-right">
        peak ${(data?.points[data.points.length - 1]?.peak ?? 0).toFixed(2)}
      </div>
    </div>
  );
}

function ExposureHeatmap({ data }: { data: ExposureHeatmapData | null }) {
  const cells = data?.cells ?? [];
  const venues = data?.venues ?? [];
  const symbols = data?.symbols ?? [];
  const total = data?.totalNotionalUsd ?? 0;
  const maxNotional = Math.max(0.01, ...cells.map(c => c.notionalUsd));

  const get = (venue: string, symbol: string, side: 'BUY' | 'SELL') =>
    cells.find(c => c.venue === venue && c.symbol === symbol && c.side === side);

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Grid3x3 size={11} className="text-[#a78bfa]" />
          <h3 className="text-[10px] font-bold text-[#94a3b8] font-mono uppercase tracking-wide">Exposure Heatmap</h3>
        </div>
        <span className="text-[9px] font-mono text-[#94a3b8]">${total.toFixed(2)} total</span>
      </div>
      {cells.length === 0 ? (
        <div className="text-[10px] text-[#475569] font-mono py-3 text-center">No open exposure</div>
      ) : (
        <div className="space-y-1">
          {venues.map(v => (
            <div key={v} className="flex items-center gap-1">
              <span className="w-10 text-[9px] font-mono text-[#94a3b8] uppercase">{v}</span>
              <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, symbols.length)}, minmax(0, 1fr))` }}>
                {symbols.map(s => {
                  const buy = get(v, s, 'BUY');
                  const sell = get(v, s, 'SELL');
                  const dominant = (buy?.notionalUsd ?? 0) >= (sell?.notionalUsd ?? 0) ? buy : sell;
                  const intensity = dominant ? Math.min(1, dominant.notionalUsd / maxNotional) : 0;
                  const color = !dominant
                    ? '#0a0f1a'
                    : dominant.side === 'BUY'
                      ? `rgba(52, 211, 153, ${0.15 + intensity * 0.65})`
                      : `rgba(239, 68, 68, ${0.15 + intensity * 0.65})`;
                  const tt = dominant
                    ? `${v} ${s} ${dominant.side} · ${dominant.count} pos · $${dominant.notionalUsd.toFixed(2)}`
                    : `${v} ${s} · empty`;
                  return (
                    <div
                      key={`${v}-${s}`}
                      title={tt}
                      className="rounded text-center text-[9px] font-mono border border-[#1f2937] py-1 px-0.5"
                      style={{ background: color, color: dominant ? '#0a0f1a' : '#475569' }}
                    >
                      <div className="font-bold">{s.replace(/-(USD|PERP)$/, '')}</div>
                      <div className="opacity-80">{dominant ? `$${dominant.notionalUsd.toFixed(0)}` : '—'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalibrationPanel({ stats }: { stats: CalibrationStats | null }) {
  const reliability = stats?.reliability ?? [];
  const total = stats?.total ?? 0;
  const brier = stats?.brier ?? 0;
  const w = 320;
  const h = 140;
  const pad = 18;

  const body = (() => {
    if (reliability.length === 0 || total === 0) {
      return (
        <div className="h-[140px] flex items-center justify-center text-[10px] text-[#475569] font-mono">
          Sin posiciones cerradas (7d)
        </div>
      );
    }
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]" preserveAspectRatio="none">
        {/* Perfect calibration diagonal */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={pad} stroke="#1f2937" strokeWidth="0.6" strokeDasharray="2 2" />
        {/* Axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#1f2937" strokeWidth="0.6" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#1f2937" strokeWidth="0.6" />
        {/* Bars: predicted (x) vs actual (bar height) */}
        {reliability.map((b) => {
          if (b.count === 0) return null;
          const cellW = (w - pad * 2) / reliability.length;
          const x = pad + b.bin * cellW;
          const y = pad + (1 - b.actual) * (h - pad * 2);
          const barH = (h - pad) - y;
          const offset = b.actual - b.predicted;
          const color = Math.abs(offset) < 0.05 ? '#22d3ee' : offset > 0 ? '#34d399' : '#facc15';
          return (
            <g key={b.bin}>
              <rect x={x + 1} y={y} width={cellW - 2} height={barH} fill={color} fillOpacity="0.6" />
              <rect x={x + 1} y={y} width={cellW - 2} height={barH} fill="none" stroke={color} strokeWidth="0.7" />
            </g>
          );
        })}
        {/* Axis labels */}
        <text x={pad} y={h - 4} fontSize="7" fill="#475569" fontFamily="monospace">0</text>
        <text x={w - pad - 4} y={h - 4} fontSize="7" fill="#475569" fontFamily="monospace">1</text>
        <text x={2} y={pad + 4} fontSize="7" fill="#475569" fontFamily="monospace">1</text>
        <text x={2} y={h - pad} fontSize="7" fill="#475569" fontFamily="monospace">0</text>
      </svg>
    );
  })();

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target size={11} className="text-[#22d3ee]" />
          <h3 className="text-[10px] font-bold text-[#94a3b8] font-mono uppercase tracking-wide">Calibration · Reliability</h3>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#94a3b8]">
          <span>brier <span className={brier < 0.20 ? 'text-[#34d399]' : brier < 0.30 ? 'text-[#facc15]' : 'text-[#ef4444]'}>{brier.toFixed(3)}</span></span>
          <span>n={total}</span>
          <span className="text-[#475569]">{stats?.window ?? "7d"}</span>
        </div>
      </div>
      {body}
      <div className="grid grid-cols-2 gap-2 pt-2 mt-1 border-t border-[#1f2937]/60">
        <div>
          <div className="text-[9px] text-[#475569] font-mono uppercase mb-1">By regime</div>
          <CalibBucketList rows={stats?.byRegime ?? []} />
        </div>
        <div>
          <div className="text-[9px] text-[#475569] font-mono uppercase mb-1">By tier</div>
          <CalibBucketList rows={stats?.byTier ?? []} />
        </div>
      </div>
    </div>
  );
}

function CalibBucketList({ rows }: { rows: Array<{ key: string; brier: number; winRate: number; count: number }> }) {
  if (rows.length === 0) return <div className="text-[9px] text-[#475569] font-mono">—</div>;
  return (
    <div className="space-y-0.5">
      {rows.slice(0, 4).map((r) => (
        <div key={r.key} className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-[#94a3b8]">{r.key}</span>
          <span className="text-[#475569]">
            <span className={r.brier < 0.20 ? 'text-[#34d399]' : r.brier < 0.30 ? 'text-[#facc15]' : 'text-[#ef4444]'}>{r.brier.toFixed(3)}</span>
            {' · '}
            {(r.winRate * 100).toFixed(0)}%
            {' · '}
            n={r.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function CorrelationMatrix({ data }: { data: CorrelationData | null }) {
  const symbols = data?.symbols ?? [];
  const matrix = data?.matrix ?? [];

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Network size={11} className="text-[#a78bfa]" />
          <h3 className="text-[10px] font-bold text-[#94a3b8] font-mono uppercase tracking-wide">PnL Correlation</h3>
        </div>
        <span className="text-[9px] font-mono text-[#475569]">{data?.window ?? "14d"} · {data?.days ?? 0}d</span>
      </div>
      {symbols.length < 2 ? (
        <div className="h-[120px] flex items-center justify-center text-[10px] text-[#475569] font-mono text-center px-2">
          Necesitamos ≥2 símbolos con cierres en el período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[9px] font-mono w-full">
            <thead>
              <tr>
                <th className="text-left text-[#475569] py-0.5"></th>
                {symbols.map(s => (
                  <th key={s} className="text-center text-[#94a3b8] px-1 py-0.5">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((s, i) => (
                <tr key={s}>
                  <td className="text-[#94a3b8] pr-1.5 py-0.5">{s}</td>
                  {symbols.map((_, j) => {
                    const v = matrix[i]?.[j] ?? 0;
                    const intensity = Math.min(1, Math.abs(v));
                    const color = i === j
                      ? '#1f2937'
                      : v > 0
                        ? `rgba(239, 68, 68, ${0.18 + intensity * 0.55})`
                        : `rgba(34, 211, 238, ${0.18 + intensity * 0.55})`;
                    return (
                      <td
                        key={j}
                        className="text-center text-[#0a0f1a] font-bold px-1 py-1.5 border border-[#0a0f1a]"
                        style={{ background: color, color: i === j ? '#475569' : '#0a0f1a' }}
                        title={`${symbols[i]} ↔ ${symbols[j]}: ${v.toFixed(3)}`}
                      >
                        {i === j ? '—' : v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2 pt-1.5 text-[9px] font-mono text-[#475569]">
            <span><span className="inline-block w-2 h-2 align-middle" style={{ background: 'rgba(34,211,238,0.6)' }} /> neg</span>
            <span><span className="inline-block w-2 h-2 align-middle" style={{ background: 'rgba(239,68,68,0.6)' }} /> pos</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RegimeTimeline({ data }: { data: RegimeSnapshots | null }) {
  const points = data?.points ?? [];
  const transitions = data?.transitions ?? 0;
  const current = data?.current ?? null;

  // Build segments: from each point until the next, paint a horizontal bar.
  // End the timeline at the most recent data point (NOT Date.now, which would
  // make this component impure during render and trip React Compiler purity
  // rules). For live data this is functionally equivalent — the last point is
  // ~now anyway — and for stale data it correctly shrinks the bar to match.
  const segments = (() => {
    if (points.length === 0) return [];
    const start = new Date(points[0].capturedAt).getTime();
    const lastPointTime = new Date(points[points.length - 1].capturedAt).getTime();
    const end = Math.max(start + 60_000, lastPointTime);
    const span = end - start;
    return points.map((p, i) => {
      const t0 = new Date(p.capturedAt).getTime();
      const t1 = i + 1 < points.length ? new Date(points[i + 1].capturedAt).getTime() : end;
      const left = ((t0 - start) / span) * 100;
      const width = Math.max(0.3, ((t1 - t0) / span) * 100);
      return { ...p, left, width };
    });
  })();

  return (
    <div className="bg-[#0c1220] border border-[#1f2937] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Layers size={11} className="text-[#22d3ee]" />
          <h3 className="text-[10px] font-bold text-[#94a3b8] font-mono uppercase tracking-wide">Regime Timeline</h3>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#94a3b8]">
          {current && (
            <span>
              now <span style={{ color: REGIME_COLORS[current.regime] ?? '#94a3b8' }} className="font-bold">{current.regime}</span>
              {" · "}vol {current.volatilityPct.toFixed(1)}%
              {" · "}mult {current.multiplier.toFixed(2)}x
            </span>
          )}
          <span>transitions <span className="text-[#facc15]">{transitions}</span></span>
          <span className="text-[#475569]">{data?.window ?? "24h"}</span>
        </div>
      </div>
      {segments.length === 0 ? (
        <div className="h-[36px] flex items-center justify-center text-[10px] text-[#475569] font-mono">
          Esperando snapshots del bot
        </div>
      ) : (
        <>
          <div className="relative h-[36px] bg-[#0a0f1a] rounded border border-[#1f2937]/60 overflow-hidden">
            {segments.map((s, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${s.left}%`,
                  width: `${s.width}%`,
                  background: REGIME_COLORS[s.regime] ?? REGIME_COLORS.UNKNOWN,
                  opacity: 0.55 + s.consistencyScore * 0.4,
                  borderRight: s.isTransition ? '1px solid rgba(250,204,21,0.7)' : 'none',
                }}
                title={`${new Date(s.capturedAt).toLocaleTimeString()} · ${s.regime} · vol ${s.volatilityPct.toFixed(1)}% · mult ${s.multiplier.toFixed(2)}x${s.previousRegime ? ` · prev ${s.previousRegime}` : ''}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1.5 text-[9px] font-mono text-[#475569]">
            {(['CALM', 'TRENDING', 'VOLATILE', 'CRISIS'] as const).map(r => (
              <span key={r} className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ background: REGIME_COLORS[r] }} />
                {r}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
