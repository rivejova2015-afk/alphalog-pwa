"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
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
  Target,
  TrendingUp,
  Wifi,
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

interface VelocityWindow {
  label: "1m" | "5m" | "15m" | "1h";
  velocity: number | null;
  acceleration: number | null;
  direction: "UP" | "DOWN" | "FLAT";
  samplesUsed: number;
}

interface MilestoneProximity {
  milestonePrice: number;
  distancePct: number;
  distanceUsd: number;
  direction: "ABOVE" | "BELOW";
  movingToward: boolean;
  timeToHitHours: number | null;
}

interface VelocitySignal {
  conditionId: string;
  symbol: string;
  question: string;
  currentPrice: number;
  marketImpliedProb: number;
  windows: VelocityWindow[];
  milestone: MilestoneProximity | null;
  velocityProbDelta: number;
  adjustedFairProb: number;
  lagEstimateMinutes: number | null;
  huntStrength: number;
  isAccelerating: boolean;
  computedAt: number;
}

// SP#5 Regime Detector
interface RegimeState {
  regime: "CALM" | "TRENDING" | "VOLATILE" | "CRISIS";
  volatilityPct: number | null;
  trend: string;
  trendStrength: number | null;
  agentMultiplier: number | null;
  consistencyScore: number | null;
  computedAt: number;
}

// SP#3 Adaptive Kelly
interface AdaptiveState {
  baseMinEdge: number | null;
  currentMinEdge: number | null;
  multiplier: number | null;
  winRateRecent: number | null;
  samplesUsed: number;
  recentLosses: number;
  trend: "TIGHTENING" | "LOOSENING" | "STABLE";
  reason: string;
}

// SP#6 Cross-Market
interface AssetMomentum {
  symbol: string;
  velocity5m: number | null;
  direction: "UP" | "DOWN" | "FLAT";
  isAccelerating: boolean;
  samplesUsed: number;
}

interface CrossMarketSignal {
  primarySymbol: string;
  primaryDirection: "UP" | "DOWN";
  assets: AssetMomentum[];
  agreementCount: number;
  strength: "STRONG" | "MODERATE" | "WEAK" | "DIVERGING";
  allAccelerating: boolean;
  edgeMultiplier: number | null;
  computedAt: number;
}

// SP#4 Sentiment Pulse
interface SentimentPulse {
  conditionId: string;
  zScoreBid: number;
  zScoreAsk: number;
  anomalyScore: number;
  signal: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  samplesUsed: number;
  priceMovedWithSignal: boolean;
}

// SP#2 Memory Bank stats
interface MemoryBankStat {
  key: string;
  wins: number;
  total: number;
  winRate: number;
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
  velocity_snapshot: VelocitySignal[] | null;
  regime_snapshot: RegimeState | null;
  adaptive_kelly_state: AdaptiveState | null;
  cross_market_snapshot: CrossMarketSignal | null;
  sentiment_snapshot: SentimentPulse[] | null;
  memory_bank_stats: MemoryBankStat[] | null;
}

interface Position {
  id: string;
  market_slug: string;
  outcome: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  size_usd: number;
  pnl_usd: number | null;
  pnl_percent: number | null;
  status: string;
  exit_reason: string | null;
  opened_at: string;
  closed_at: string | null;
  redeemed: boolean | null;
  redeemed_usd: number | null;
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

interface Trade {
  id: string;
  trade_type: string;   // 'ENTRY' | 'EXIT' | 'SIMULATED'
  market_slug: string;
  outcome: string;
  side: string;
  price: number | null;
  size_usd: number | null;
  fee_usd: number | null;
  pnl_usd: number | null;
  status: string;
  executed_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-green-500",
  STOPPED: "bg-gray-400",
  PAUSED: "bg-yellow-500",
  ERROR: "bg-red-500",
};

const SYMBOL_COLORS: Record<string, { stroke: string; fill: string; text: string }> = {
  BTC:    { stroke: "#f59e0b", fill: "#f59e0b22", text: "#f59e0b" },
  ETH:    { stroke: "#818cf8", fill: "#818cf822", text: "#818cf8" },
  SOL:    { stroke: "#34d399", fill: "#34d39922", text: "#34d399" },
  CRYPTO: { stroke: "#22d3ee", fill: "#22d3ee22", text: "#22d3ee" },
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

function fmtVelocity(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}K/h`;
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}/h`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Hunt Map 3D (Canvas) ──────────────────────────────────────────────────

function HuntMap3D({ signals }: { signals: VelocitySignal[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tickRef = useRef(0);
  // Cache de gradients por conditionId+x+y — evita recrearlos en cada frame
  const gradientCache = useRef<Map<string, { x: number; y: number; grad: CanvasGradient }>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const W = canvas.width;
    const H = canvas.height;

    // Perspective projection: (worldX, worldY, worldZ) → (px, py)
    // worldX: 0=left(far from milestone), 1=right(close to milestone)
    // worldY: 0=bottom(low prob), 1=top(high prob)
    // worldZ: 0=back, 1=front (hunt strength)
    const VP = { x: W * 0.5, y: H * 0.08 }; // vanishing point
    const BASE_Y = H * 0.92;
    const DEPTH = H * 0.7;

    function project(wx: number, wy: number): { x: number; y: number; scale: number } {
      // Tilted plane: wx → horizontal, wy → depth into screen
      const groundX = W * 0.05 + wx * W * 0.9;
      const groundY = BASE_Y - wy * DEPTH * 0.6;

      // Apply perspective toward vanishing point
      const t = (groundY - BASE_Y) / (VP.y - BASE_Y);
      const scale = 1 - t * 0.5;
      const px = VP.x + (groundX - VP.x) * (1 - t * 0.45);
      const py = groundY;
      return { x: px, y: py, scale };
    }

    function draw(tick: number) {
      ctx.clearRect(0, 0, W, H);

      // ── Background grid ──
      ctx.strokeStyle = "#1a2740";
      ctx.lineWidth = 0.5;

      // Horizontal grid lines (depth)
      const ROWS = 8;
      for (let r = 0; r <= ROWS; r++) {
        const wy = r / ROWS;
        const left  = project(0, wy);
        const right = project(1, wy);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      }

      // Vertical grid lines (left-right)
      const COLS = 10;
      for (let c = 0; c <= COLS; c++) {
        const wx = c / COLS;
        const front = project(wx, 0);
        const back  = project(wx, 1);
        ctx.beginPath();
        ctx.moveTo(front.x, front.y);
        ctx.lineTo(back.x, back.y);
        ctx.stroke();
      }

      // ── Axis labels ──
      ctx.font = "9px monospace";
      ctx.fillStyle = "#334155";
      ctx.textAlign = "center";

      // X-axis: milestone distance (bottom)
      ["20%", "15%", "10%", "5%", "0%"].forEach((label, i) => {
        const pt = project(i / 4, 0);
        ctx.fillText(label, pt.x, pt.y + 12);
      });

      // Y-axis label
      ctx.save();
      ctx.fillStyle = "#475569";
      ctx.font = "8px monospace";
      const left0 = project(0, 0);
      const left1 = project(0, 1);
      ctx.fillText("prob →", left0.x - 24, (left0.y + left1.y) / 2);
      ctx.restore();

      // ── Axis titles ──
      ctx.fillStyle = "#475569";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("← distancia al hito", W * 0.05, H - 2);

      // ── Market bubbles ──
      // Sort by huntStrength ascending so strongest renders on top
      const sorted = [...signals].sort((a, b) => a.huntStrength - b.huntStrength);

      for (const sig of sorted) {
        if (!sig.milestone) continue;

        // Map to world coordinates
        // X: milestone distance (0%=right, 20%=left) → invert
        const wx = 1 - Math.min(sig.milestone.distancePct, 20) / 20;
        // Y: implied probability
        const wy = Math.max(0, Math.min(1, sig.marketImpliedProb));

        const { x, y, scale } = project(wx, wy);

        // Bubble radius: proportional to huntStrength (min 4, max 22)
        const baseR = 4 + (sig.huntStrength / 100) * 18;
        const r = baseR * scale;

        const colors = SYMBOL_COLORS[sig.symbol] ?? SYMBOL_COLORS.CRYPTO;

        // Pulse animation for accelerating markets
        const pulse = sig.isAccelerating
          ? 1 + 0.12 * Math.sin((tick / 8) + sig.conditionId.charCodeAt(0))
          : 1;
        const rAnimated = r * pulse;

        // Outer glow — gradient cacheado por conditionId, recreado solo si cambió la posición
        if (sig.huntStrength > 30) {
          const glowR = rAnimated * 2.2;
          const cacheKey = sig.conditionId;
          const cached = gradientCache.current.get(cacheKey);
          let grad: CanvasGradient;
          if (!cached || Math.abs(cached.x - x) > 1 || Math.abs(cached.y - y) > 1) {
            grad = ctx.createRadialGradient(x, y, rAnimated * 0.5, x, y, glowR);
            grad.addColorStop(0, colors.stroke + "44");
            grad.addColorStop(1, "transparent");
            gradientCache.current.set(cacheKey, { x, y, grad });
          } else {
            grad = cached.grad;
          }
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Bubble fill
        ctx.beginPath();
        ctx.arc(x, y, rAnimated, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = sig.isAccelerating ? 1.8 : 1;
        ctx.fill();
        ctx.stroke();

        // Symbol label inside bubble
        if (r > 8) {
          ctx.fillStyle = colors.text;
          ctx.font = `bold ${Math.round(8 * scale)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sig.symbol, x, y);
        }

        // Hunt strength badge
        if (sig.huntStrength > 20) {
          ctx.font = `${Math.round(7 * scale)}px monospace`;
          ctx.fillStyle = "#94a3b8";
          ctx.textBaseline = "top";
          ctx.fillText(`${sig.huntStrength}`, x, y + rAnimated + 2);
        }
      }

      // ── Legend ──
      const legendItems = Object.entries(SYMBOL_COLORS).filter(([k]) => k !== "CRYPTO");
      legendItems.forEach(([sym, c], i) => {
        const lx = W - 60;
        const ly = 12 + i * 14;
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.fill;
        ctx.strokeStyle = c.stroke;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(sym, lx + 8, ly);
      });
    }

    function loop() {
      tickRef.current++;
      draw(tickRef.current);
      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [signals]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={260}
      className="w-full rounded"
      style={{ imageRendering: "crisp-edges", background: "#0a0e1a" }}
    />
  );
}

// ─── Velocity Gauge Strip ─────────────────────────────────────────────────

function VelocityGauges({ windows }: { windows: VelocityWindow[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {windows.map((w) => {
        const absV = Math.abs(w.velocity ?? 0);
        const maxV = 2000; // $/h scale
        const barPct = Math.min(100, (absV / maxV) * 100);
        const isUp = w.direction === "UP";
        const isFlat = w.direction === "FLAT";
        const color = isFlat ? "#475569" : isUp ? "#34d399" : "#f87171";
        const acc = w.acceleration ?? 0;
        const accLabel = acc > 50 ? "↑↑" : acc < -50 ? "↓↓" : "";

        return (
          <div key={w.label} className="bg-[#0d1424] rounded-lg px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#475569] font-mono">{w.label}</span>
              <span className="text-[9px] font-mono" style={{ color: "#64748b" }}>{accLabel}</span>
            </div>
            {/* Bar */}
            <div className="h-1.5 rounded-full bg-[#1e2a3a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-[11px] font-mono font-bold" style={{ color }}>
              {isFlat ? "FLAT" : fmtVelocity(w.velocity)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Velocity Panel ───────────────────────────────────────────────────────

function VelocityPanel({ signals }: { signals: VelocitySignal[] }) {
  const topSignal = signals.reduce(
    (best, s) => (s.huntStrength > (best?.huntStrength ?? -1) ? s : best),
    null as VelocitySignal | null
  );

  // BTC windows (pick BTC signal or first available)
  const btcSignal = signals.find(s => s.symbol === "BTC") ?? signals[0] ?? null;

  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#22d3ee]" />
          <span className="text-sm font-bold text-[#e2e8f0] font-mono">Velocity Detector</span>
          <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #1</span>
        </div>
        {topSignal && topSignal.huntStrength > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#475569]">best hunt</span>
            <span
              className="px-2 py-0.5 rounded font-mono font-bold text-xs"
              style={{
                backgroundColor: topSignal.huntStrength > 60 ? "#16450e" : topSignal.huntStrength > 30 ? "#2d2a0a" : "#1e2a3a",
                color: topSignal.huntStrength > 60 ? "#34d399" : topSignal.huntStrength > 30 ? "#fbbf24" : "#64748b",
              }}
            >
              {topSignal.huntStrength}/100
            </span>
          </div>
        )}
      </div>

      {/* BTC Velocity Gauges */}
      {btcSignal && (
        <div>
          <div className="text-[10px] text-[#475569] font-mono mb-1.5">
            BTC velocidad — ${fmt(btcSignal.currentPrice, 0)} spot
          </div>
          <VelocityGauges windows={btcSignal.windows ?? []} />
        </div>
      )}

      {/* 3D Hunt Map */}
      <div>
        <div className="text-[10px] text-[#475569] font-mono mb-1.5">
          mapa de caza — X: distancia al hito · Y: prob implícita · tamaño: hunt strength
        </div>
        {signals.filter(s => s.milestone).length > 0 ? (
          <HuntMap3D signals={signals} />
        ) : (
          <div className="h-20 flex items-center justify-center text-xs text-[#334155]">
            El agente necesita ≥1 mercado con hito parseado para mostrar el mapa.
          </div>
        )}
      </div>

      {/* Per-market table */}
      {signals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#334155] border-b border-[#1e2a3a]">
                <th className="text-left pb-1.5 pr-3 font-mono">mercado</th>
                <th className="text-right pb-1.5 pr-3 font-mono">prob</th>
                <th className="text-right pb-1.5 pr-3 font-mono">Δvel</th>
                <th className="text-right pb-1.5 pr-3 font-mono">lag</th>
                <th className="text-right pb-1.5 font-mono">hunt</th>
              </tr>
            </thead>
            <tbody>
              {signals
                .sort((a, b) => b.huntStrength - a.huntStrength)
                .map((sig) => {
                  const colors = SYMBOL_COLORS[sig.symbol] ?? SYMBOL_COLORS.CRYPTO;
                  const delta = sig.velocityProbDelta;
                  return (
                    <tr key={sig.conditionId} className="border-b border-[#0f1724]">
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: colors.stroke }}
                          />
                          {sig.isAccelerating && (
                            <span className="text-[#f59e0b] text-[9px]">↑↑</span>
                          )}
                          <span
                            className="truncate max-w-[160px] text-[#94a3b8]"
                            title={sig.question}
                          >
                            {sig.milestone
                              ? `${sig.symbol} $${(sig.milestone.milestonePrice / 1000).toFixed(0)}K`
                              : sig.question.slice(0, 28)}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[#64748b]">
                        {fmt(sig.marketImpliedProb * 100, 1)}%
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono"
                        style={{ color: delta > 0 ? "#34d399" : delta < 0 ? "#f87171" : "#475569" }}>
                        {delta !== 0 ? `${delta > 0 ? "+" : ""}${fmt(delta * 100, 1)}%` : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[#64748b]">
                        {sig.lagEstimateMinutes ? `~${sig.lagEstimateMinutes}m` : "—"}
                      </td>
                      <td className="py-1.5 text-right">
                        <span
                          className="px-1.5 py-0.5 rounded font-mono font-bold"
                          style={{
                            backgroundColor: sig.huntStrength > 60 ? "#16450e" : sig.huntStrength > 30 ? "#2d2a0a" : "#1a1f2e",
                            color: sig.huntStrength > 60 ? "#34d399" : sig.huntStrength > 30 ? "#fbbf24" : "#475569",
                          }}
                        >
                          {sig.huntStrength}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {signals.length === 0 && (
        <p className="text-xs text-[#334155] text-center py-4">
          El agente computará señales de velocidad en el próximo tick (≤5s).
        </p>
      )}
    </div>
  );
}

// ─── SP#5 Regime Panel ────────────────────────────────────────────────────────

const REGIME_CONFIG: Record<string, { color: string; bg: string; label: string; desc: string }> = {
  CALM:     { color: "#34d399", bg: "#16450e", label: "CALM",     desc: "Low volatility — Kelly full" },
  TRENDING: { color: "#22d3ee", bg: "#0c2e40", label: "TREND",    desc: "Directional — Kelly +30%" },
  VOLATILE: { color: "#fbbf24", bg: "#2d2a0a", label: "VOLATILE", desc: "High vol — Kelly ×0.5" },
  CRISIS:   { color: "#f87171", bg: "#3d0a0a", label: "CRISIS",   desc: "Extreme — Kelly ×0.2" },
};

function RegimePanel({ regime }: { regime: RegimeState }) {
  const cfg = REGIME_CONFIG[regime.regime] ?? REGIME_CONFIG.CALM;
  const volPct = fmt(regime.volatilityPct, 1);
  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4" style={{ color: cfg.color }} />
        <span className="text-sm font-bold text-[#e2e8f0] font-mono">Regime Detector</span>
        <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #5</span>
      </div>

      <div className="flex items-center justify-between">
        <div
          className="px-4 py-2.5 rounded-lg text-center"
          style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}33` }}
        >
          <div className="text-xl font-bold font-mono" style={{ color: cfg.color }}>{cfg.label}</div>
          <div className="text-[10px] mt-0.5" style={{ color: cfg.color + "99" }}>{cfg.desc}</div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-[10px] text-[#475569]">Annualized Vol</div>
          <div className="text-lg font-mono font-bold" style={{ color: cfg.color }}>{volPct}%</div>
          <div className="text-[10px] text-[#475569]">Kelly ×{fmt(regime.agentMultiplier, 2)}</div>
        </div>
      </div>

      {/* Vol bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] text-[#334155] font-mono">
          <span>0%</span><span>calm 30%</span><span>vol 55%</span><span>crisis 120%</span>
        </div>
        <div className="h-2 rounded-full bg-[#1e2a3a] relative overflow-hidden">
          {/* Calm zone */}
          <div className="absolute left-0 top-0 h-full rounded-l-full bg-[#16450e]" style={{ width: "25%" }} />
          {/* Trending zone */}
          <div className="absolute top-0 h-full bg-[#0c2e40]" style={{ left: "25%", width: "20.8%" }} />
          {/* Volatile zone */}
          <div className="absolute top-0 h-full bg-[#2d2a0a]" style={{ left: "45.8%", width: "54.2%" }} />
          {/* Crisis zone */}
          <div className="absolute top-0 h-full bg-[#3d0a0a]" style={{ left: "100%", width: "0%" }} />
          {/* Needle */}
          <div
            className="absolute top-0 w-0.5 h-full rounded-full"
            style={{
              left: `${Math.min(98, ((regime.volatilityPct ?? 0) / 140) * 100)}%`,
              backgroundColor: cfg.color,
              boxShadow: `0 0 6px ${cfg.color}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── SP#3 Adaptive Kelly Panel ────────────────────────────────────────────────

function AdaptiveKellyPanel({ state }: { state: AdaptiveState }) {
  const edgePct = fmt(state.currentMinEdge != null ? state.currentMinEdge * 100 : null, 2);
  const basePct = fmt(state.baseMinEdge != null ? state.baseMinEdge * 100 : null, 2);
  const winRateDisplay = state.winRateRecent !== null ? fmt(state.winRateRecent != null ? state.winRateRecent * 100 : null, 1) : null;
  const mult = state.multiplier ?? 1;
  const multColor = mult >= 1.0 ? "#34d399" : mult >= 0.7 ? "#fbbf24" : "#f87171";

  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-[#a78bfa]" />
        <span className="text-sm font-bold text-[#e2e8f0] font-mono">Adaptive Kelly</span>
        <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #3</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#0d1424] rounded-lg px-3 py-2">
          <div className="text-[9px] text-[#475569] font-mono mb-1">base edge</div>
          <div className="text-base font-mono font-bold text-[#64748b]">{basePct}%</div>
        </div>
        <div className="bg-[#0d1424] rounded-lg px-3 py-2">
          <div className="text-[9px] text-[#475569] font-mono mb-1">multiplier</div>
          <div className="text-base font-mono font-bold" style={{ color: multColor }}>×{mult.toFixed(2)}</div>
        </div>
        <div className="bg-[#0d1424] rounded-lg px-3 py-2">
          <div className="text-[9px] text-[#475569] font-mono mb-1">current edge</div>
          <div className="text-base font-mono font-bold text-[#22d3ee]">{edgePct}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#475569]">win rate ({state.samplesUsed} trades)</span>
        <span className={winRateDisplay ? (parseFloat(winRateDisplay) >= 55 ? "text-[#34d399]" : parseFloat(winRateDisplay) >= 45 ? "text-[#fbbf24]" : "text-[#f87171]") : "text-[#334155]"}>
          {winRateDisplay ? `${winRateDisplay}%` : "—"}
        </span>
      </div>

      {state.recentLosses > 0 && (
        <div className="flex items-center gap-2 text-[11px] bg-[#3d1a0a] rounded px-3 py-1.5">
          <AlertTriangle className="w-3 h-3 text-[#f87171]" />
          <span className="text-[#f87171] font-mono">{state.recentLosses} consecutive losses → edge raised</span>
        </div>
      )}
    </div>
  );
}

// ─── SP#6 Cross-Market Panel ──────────────────────────────────────────────────

const ALIGNMENT_CONFIG: Record<string, { color: string; bg: string }> = {
  STRONG:    { color: "#34d399", bg: "#16450e" },
  MODERATE:  { color: "#22d3ee", bg: "#0c2e40" },
  WEAK:      { color: "#94a3b8", bg: "#1e2a3a" },
  DIVERGING: { color: "#f87171", bg: "#3d0a0a" },
};

function CrossMarketPanel({ signal }: { signal: CrossMarketSignal }) {
  const cfg = ALIGNMENT_CONFIG[signal.strength] ?? ALIGNMENT_CONFIG.WEAK;
  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#34d399]" />
        <span className="text-sm font-bold text-[#e2e8f0] font-mono">Cross-Market</span>
        <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #6</span>
      </div>

      <div className="flex items-center justify-between">
        <div
          className="px-3 py-2 rounded-lg"
          style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}33` }}
        >
          <div className="text-sm font-bold font-mono" style={{ color: cfg.color }}>{signal.strength}</div>
          <div className="text-[9px] mt-0.5" style={{ color: cfg.color + "99" }}>
            {signal.agreementCount}/{signal.assets.length} aligned
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#475569] mb-0.5">edge ×</div>
          <div className="text-xl font-mono font-bold" style={{ color: cfg.color }}>
            {fmt(signal.edgeMultiplier, 2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(signal.assets ?? []).map((d) => {
          const c = SYMBOL_COLORS[d.symbol] ?? SYMBOL_COLORS.CRYPTO;
          const dirColor = d.direction === "UP" ? "#34d399" : d.direction === "DOWN" ? "#f87171" : "#475569";
          return (
            <div key={d.symbol} className="bg-[#0d1424] rounded px-2 py-1.5 text-center">
              <div className="text-[10px] font-mono font-bold" style={{ color: c.text }}>{d.symbol}</div>
              <div className="text-[9px] font-mono mt-0.5" style={{ color: dirColor }}>
                {d.direction === "UP" ? "↑" : d.direction === "DOWN" ? "↓" : "→"} {d.velocity5m != null ? Math.abs(d.velocity5m).toFixed(0) : "—"}/h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SP#4 Sentiment Pulse Panel ───────────────────────────────────────────────

function SentimentPanel({ pulses }: { pulses: SentimentPulse[] }) {
  const topPulses = pulses.slice(0, 6);
  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-[#f59e0b]" />
        <span className="text-sm font-bold text-[#e2e8f0] font-mono">Sentiment Pulse</span>
        <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #4</span>
      </div>

      {topPulses.length === 0 ? (
        <p className="text-xs text-[#334155] text-center py-2">Acumulando datos de orderbook (5 min)…</p>
      ) : (
        <div className="space-y-1.5">
          {topPulses.map((p) => {
            const isAcc = p.signal === "ACCUMULATION";
            const isDist = p.signal === "DISTRIBUTION";
            const sigColor = isAcc ? "#34d399" : isDist ? "#f87171" : "#475569";
            const sigLabel = isAcc ? "ACC" : isDist ? "DIST" : "NEU";
            const zBid = (p.zScoreBid ?? 0).toFixed(1);
            const zAsk = (p.zScoreAsk ?? 0).toFixed(1);
            const score = p.anomalyScore ?? 0;
            return (
              <div key={p.conditionId} className="flex items-center gap-2 text-[11px] bg-[#0d1424] rounded px-3 py-1.5">
                <span
                  className="w-7 text-center rounded px-1 font-mono font-bold text-[10px]"
                  style={{ color: sigColor, backgroundColor: sigColor + "15" }}
                >
                  {sigLabel}
                </span>
                <span className="flex-1 truncate text-[#64748b] font-mono">
                  {p.conditionId.slice(0, 10)}…
                </span>
                <span className="text-[#475569] font-mono">bid z{zBid}</span>
                <span className="text-[#475569] font-mono">ask z{zAsk}</span>
                <span className="font-mono font-bold" style={{ color: score >= 20 ? "#34d399" : score <= -20 ? "#f87171" : "#64748b" }}>
                  {score >= 0 ? "+" : ""}{score.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SP#2 Memory Bank Panel ───────────────────────────────────────────────────

function MemoryBankPanel({ stats }: { stats: MemoryBankStat[] }) {
  const sorted = [...stats].sort((a, b) => b.total - a.total).slice(0, 8);
  return (
    <div className="bg-[#0c1220] border border-[#1e2a3a] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#818cf8]" />
          <span className="text-sm font-bold text-[#e2e8f0] font-mono">Memory Bank</span>
          <span className="text-[10px] text-[#475569] font-mono">SUPERPOWER #2</span>
        </div>
        <span className="text-[10px] text-[#475569] font-mono">{stats.length} patrones</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-[#334155] text-center py-2">Sin historial aún — el agente aprenderá con cada trade.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#334155] border-b border-[#1e2a3a]">
                <th className="text-left pb-1.5 pr-2 font-mono">patrón</th>
                <th className="text-right pb-1.5 pr-2 font-mono">trades</th>
                <th className="text-right pb-1.5 font-mono">win%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const parts = s.key.split("|");
                const label = parts.slice(0, 3).join(" · ");
                const wr = (s.winRate * 100).toFixed(0);
                const wrColor = s.winRate >= 0.6 ? "#34d399" : s.winRate >= 0.45 ? "#fbbf24" : "#f87171";
                return (
                  <tr key={s.key} className="border-b border-[#0f1724]">
                    <td className="py-1.5 pr-2">
                      <span className="text-[#64748b] font-mono truncate max-w-[160px] block" title={s.key}>{label}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-[#475569]">{s.total}</td>
                    <td className="py-1.5 text-right font-mono font-bold" style={{ color: wrColor }}>{wr}%</td>
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

// ─── Setup Panel (no agent yet) ──────────────────────────────────────────────

function PolyArbSetup({ onCreated }: { onCreated: (agent: Agent) => void }) {
  const [creating, setCreating] = useState(false);

  const createAgent = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/polyarb/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "PolyArb Alpha v1", starting_capital_usd: 50 }),
      });
      if (res.status === 409) {
        // Already exists — just refetch
        const list = await fetch("/api/polyarb/agents").then((r) => r.json()) as Agent[];
        if (list[0]) onCreated(list[0]);
        return;
      }
      const agent = await res.json() as Agent;
      if (agent?.id) onCreated(agent);
      else toast.error("Error creando agente");
    } catch {
      toast.error("Error de red");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto">
        <Bot className="w-8 h-8 text-cyan-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white font-mono mb-2">PolyArb no configurado</h2>
        <p className="text-sm text-zinc-400">
          El agente autónomo de Polymarket no tiene registro en la base de datos aún.
          Haz clic para inicializarlo — las credenciales están almacenadas en Fly.io y Supabase.
        </p>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 text-left space-y-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-green-400">✓</span> Wallet MetaMask configurada en Fly secrets
        </div>
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-green-400">✓</span> Credenciales CLOB API encriptadas en Supabase
        </div>
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-green-400">✓</span> Modo LIVE activo (DRY_RUN removido)
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-yellow-400">⚠</span> Falta row en <code className="text-cyan-400">polyarb_agents</code> → inicializar abajo
        </div>
      </div>

      <button
        onClick={createAgent}
        disabled={creating}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition-colors"
      >
        {creating ? "Inicializando agente..." : "Inicializar PolyArb Agent"}
      </button>

      <p className="text-xs text-zinc-600">
        Esto crea el registro del agente con configuración por defecto. El bot en Fly.io ya está corriendo.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PolyArbDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [cbEvents, setCbEvents] = useState<CBEvent[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesTotal, setTradesTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/polyarb/agents")
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as Agent[]) : [];
        setAgents(list);
        if (list.length > 0) setActiveAgent(list[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!activeAgent) return;
    if (document.hidden) return; // no polling cuando el tab está en background
    const [telRes, posRes, closedRes, cbRes, eqRes, tradesRes] = await Promise.allSettled([
      fetch("/api/polyarb/telemetry", { signal }).then((r) => r.json()),
      fetch("/api/polyarb/positions?status=open", { signal }).then((r) => r.json()),
      fetch("/api/polyarb/positions?status=closed&limit=20", { signal }).then((r) => r.json()),
      fetch("/api/polyarb/circuit-breaker?limit=10", { signal }).then((r) => r.json()),
      fetch("/api/polyarb/telemetry/history?days=7", { signal }).then((r) => r.json()),
      fetch("/api/polyarb/trades?limit=50", { signal }).then((r) => r.json()),
    ]);
    if (signal?.aborted) return; // descartar respuesta si se desmontó
    if (telRes.status === "fulfilled") setTelemetry(telRes.value);
    if (posRes.status === "fulfilled") setPositions(posRes.value.data ?? []);
    if (closedRes.status === "fulfilled") setClosedPositions(closedRes.value.data ?? []);
    if (cbRes.status === "fulfilled") setCbEvents(cbRes.value ?? []);
    if (eqRes.status === "fulfilled") setEquityCurve(eqRes.value ?? []);
    if (tradesRes.status === "fulfilled") {
      setTrades(tradesRes.value.data ?? []);
      setTradesTotal(tradesRes.value.total ?? 0);
    }
  }, [activeAgent]);

  // ── Polling fallback (30s) — Realtime handles the hot path ──────────────────
  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    const interval = setInterval(() => void fetchData(controller.signal), 30_000);
    const onVisible = () => { if (!document.hidden) void fetchData(controller.signal); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  // ── Supabase Realtime — instant updates for telemetry, positions, trades ──
  useEffect(() => {
    if (!activeAgent) return;
    const agentId = activeAgent.id;
    const supabase = createClient();

    const channel = supabase
      .channel(`polyarb:${agentId}`)
      // Balance & metrics — telemetry row is upserted every 5s by the bot
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polyarb_telemetry', filter: `agent_id=eq.${agentId}` },
        (payload) => {
          const row = payload.new;
          if (row && typeof row === 'object' && !('error' in row)) {
            setTelemetry(row as Telemetry);
          }
        }
      )
      // Positions — refresh both open and closed whenever any position changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polyarb_positions', filter: `agent_id=eq.${agentId}` },
        () => {
          fetch('/api/polyarb/positions?status=open')
            .then(r => r.json())
            .then((d: { data?: unknown[] }) => setPositions((d.data ?? []) as Position[]))
            .catch(() => {});
          fetch('/api/polyarb/positions?status=closed&limit=20')
            .then(r => r.json())
            .then((d: { data?: unknown[] }) => setClosedPositions((d.data ?? []) as Position[]))
            .catch(() => {});
        }
      )
      // New trade records (ENTRY or EXIT) — refresh history
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polyarb_trades', filter: `agent_id=eq.${agentId}` },
        () => {
          fetch('/api/polyarb/trades?limit=50')
            .then(r => r.json())
            .then((d: { data?: unknown[]; total?: number }) => {
              setTrades((d.data ?? []) as Trade[]);
              setTradesTotal(d.total ?? 0);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [activeAgent?.id]);

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
    return <PolyArbSetup onCreated={(agent) => { setAgents([agent]); setActiveAgent(agent); }} />;
  }

  const pnl = telemetry?.total_pnl_usd ?? 0;
  const startCap = activeAgent?.starting_capital_usd ?? 50;
  const pnlPct = (pnl / startCap) * 100;

  const heartbeatMs = telemetry?.last_heartbeat_at
    ? Date.now() - new Date(telemetry.last_heartbeat_at).getTime()
    : Infinity;
  const polymarketActive = heartbeatMs < 30_000;

  const velocitySignals: VelocitySignal[] = telemetry?.velocity_snapshot ?? [];
  const regimeState = telemetry?.regime_snapshot ?? null;
  const adaptiveKellyState = telemetry?.adaptive_kelly_state ?? null;
  const crossMarketSignal = telemetry?.cross_market_snapshot ?? null;
  const sentimentPulses = telemetry?.sentiment_snapshot ?? [];
  const memoryBankStats = telemetry?.memory_bank_stats ?? [];

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

      {/* ── Métricas principales ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Balance Total" value={`$${fmt(telemetry?.available_balance_usd)}`} sub="CLOB + wallet" />
        <MetricCard label="Equity Total" value={`$${fmt(telemetry?.equity_usd)}`} sub={null} />
        <MetricCard label="P&L Neto" value={fmtUsd(pnl)} sub={`${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 1)}%`} positive={pnl >= 0} />
        <MetricCard label="Win Rate" value={telemetry?.win_rate ? `${fmt(telemetry.win_rate, 1)}%` : "—"} sub={null} />
      </div>

      {/* ── Métricas secundarias ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Profit Factor" value={telemetry?.profit_factor ? fmt(telemetry.profit_factor) : "—"} sub={null} />
        <MetricCard label="Max Drawdown" value={telemetry?.max_drawdown_pct ? `${fmt(telemetry.max_drawdown_pct, 1)}%` : "—"} sub={null} />
        <MetricCard label="Open Positions" value={String(telemetry?.open_positions_count ?? 0)} sub={null} />
        <MetricCard label="Errors (1h)" value={String(telemetry?.error_count_1h ?? 0)} sub={null} positive={(telemetry?.error_count_1h ?? 0) === 0} />
      </div>

      {/* ── VELOCITY DETECTOR ───────────────────────────────────────────── */}
      <VelocityPanel signals={velocitySignals} />

      {/* ── SUPERPOWERS #2–#6 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regimeState && <RegimePanel regime={regimeState} />}
        {adaptiveKellyState && <AdaptiveKellyPanel state={adaptiveKellyState} />}
        {crossMarketSignal && <CrossMarketPanel signal={crossMarketSignal} />}
        {sentimentPulses.length > 0 && <SentimentPanel pulses={sentimentPulses} />}
      </div>
      {memoryBankStats.length > 0 && <MemoryBankPanel stats={memoryBankStats} />}

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

      {/* ── Historial de posiciones cerradas ───────────────────────────── */}
      <ClosedPositionsSection positions={closedPositions} onSettled={() => void fetchData()} />

      {/* ── Trade History & P&L ─────────────────────────────────────────── */}
      <TradeHistorySection trades={trades} tradesTotal={tradesTotal} />

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

// ─── Closed Positions Section ────────────────────────────────────────────────

function ClosedPositionsSection({ positions, onSettled }: { positions: Position[]; onSettled: () => void }) {
  const [sweeping, setSweeping] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/polyarb/settlement')
      .then(r => r.json())
      .then((d: { pending?: number }) => setPendingCount(d.pending ?? 0))
      .catch(() => {});
  }, [positions]);

  const runSweep = async () => {
    setSweeping(true);
    try {
      const res = await fetch('/api/polyarb/settlement', { method: 'POST' });
      const d = await res.json() as { swept?: number; wins?: number; losses?: number; totalPnlUsd?: number };
      if ((d.swept ?? 0) > 0) {
        toast.success(`${d.swept} operaciones liquidadas: ${d.wins} ganadas, ${d.losses} perdidas | P&L: ${fmtUsd(d.totalPnlUsd ?? 0)}`);
        onSettled();
      } else {
        toast.info('Sin operaciones pendientes de liquidar');
      }
      setPendingCount(0);
    } catch {
      toast.error('Error al liquidar historial');
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="bg-zinc-800/40 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" /> Historial de Operaciones ({positions.length})
        </h2>
        {(pendingCount ?? 0) > 0 && (
          <button
            onClick={() => void runSweep()}
            disabled={sweeping}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50"
          >
            {sweeping ? <span className="animate-spin">⟳</span> : <Zap className="w-3 h-3" />}
            {sweeping ? 'Liquidando...' : `Liquidar ${pendingCount} pendientes`}
          </button>
        )}
      </div>
      {positions.length === 0 && (pendingCount ?? 0) === 0 && (
        <p className="text-xs text-zinc-500">Sin operaciones cerradas aún.</p>
      )}
      {positions.length > 0 && <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-zinc-500 border-b border-zinc-700">
            <tr>
              <th className="pb-2 pr-3">Mercado</th>
              <th className="pb-2 pr-3">Resultado</th>
              <th className="pb-2 pr-3">Entrada</th>
              <th className="pb-2 pr-3">Salida</th>
              <th className="pb-2 pr-3">P&L</th>
              <th className="pb-2 pr-3">Canjeado</th>
              <th className="pb-2">Cerrado</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {positions.map((p) => {
              const won = p.exit_reason?.includes('win') ?? (p.pnl_usd !== null ? p.pnl_usd > 0 : null);
              return (
                <tr key={p.id} className="border-b border-zinc-800">
                  <td className="py-2 pr-3 truncate max-w-[160px] font-mono text-[10px]">{p.market_slug.split('-').slice(-1)[0] ? `…-${p.market_slug.split('-').slice(-1)[0]}` : p.market_slug}</td>
                  <td className="py-2 pr-3">
                    {won === true ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-medium">✓ GANÓ</span>
                    ) : won === false ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 font-medium">✗ PERDIÓ</span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono">{fmt(p.entry_price, 3)}</td>
                  <td className="py-2 pr-3 font-mono">{p.exit_price != null ? fmt(p.exit_price, 3) : '—'}</td>
                  <td className="py-2 pr-3">
                    {p.pnl_usd !== null ? (
                      <span className={p.pnl_usd >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>{fmtUsd(p.pnl_usd)}</span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {p.redeemed ? (
                      <span className="text-cyan-400">✓ ${fmt(p.redeemed_usd)}</span>
                    ) : (
                      <span className="text-zinc-600">pendiente</span>
                    )}
                  </td>
                  <td className="py-2 text-zinc-500">{p.closed_at ? timeAgo(p.closed_at) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// ─── Trade History Section ────────────────────────────────────────────────────

function TradeHistorySection({ trades, tradesTotal }: { trades: Trade[]; tradesTotal: number }) {
  // P&L stats come from EXIT trades only (ENTRY trades have null pnl_usd)
  const exitTrades = trades.filter(t => t.trade_type === 'EXIT' || (t.trade_type === 'SIMULATED' && t.pnl_usd != null));
  const wins = exitTrades.filter((t) => t.pnl_usd != null && t.pnl_usd > 0);
  const losses = exitTrades.filter((t) => t.pnl_usd != null && t.pnl_usd < 0);
  const totalProfit = wins.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const totalLoss = losses.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const netPnl = totalProfit + totalLoss;
  const totalFees = trades.reduce((s, t) => s + (t.fee_usd ?? 0), 0);
  const winRate = exitTrades.length > 0 ? (wins.length / exitTrades.length) * 100 : null;

  return (
    <div className="bg-zinc-800/40 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Historial de Operaciones
        </h2>
        <span className="text-xs text-zinc-500">{tradesTotal} totales</span>
      </div>

      {/* P&L Summary mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
          <div className="text-[10px] text-zinc-500 mb-1">Profit Total</div>
          <div className="text-sm font-bold text-green-400">+${totalProfit.toFixed(2)}</div>
          <div className="text-[10px] text-zinc-600">{wins.length} operaciones ganadoras</div>
        </div>
        <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
          <div className="text-[10px] text-zinc-500 mb-1">Loss Total</div>
          <div className="text-sm font-bold text-red-400">-${Math.abs(totalLoss).toFixed(2)}</div>
          <div className="text-[10px] text-zinc-600">{losses.length} operaciones perdedoras</div>
        </div>
        <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
          <div className="text-[10px] text-zinc-500 mb-1">P&L Neto</div>
          <div className={`text-sm font-bold ${netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {netPnl >= 0 ? "+" : ""}{netPnl.toFixed(2)}$
          </div>
          <div className="text-[10px] text-zinc-600">Win rate: {winRate !== null ? `${winRate.toFixed(0)}%` : "—"}</div>
        </div>
        <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
          <div className="text-[10px] text-zinc-500 mb-1">Fees Pagados</div>
          <div className="text-sm font-bold text-yellow-400">-${totalFees.toFixed(2)}</div>
          <div className="text-[10px] text-zinc-600">{trades.length} trades</div>
        </div>
      </div>

      {/* Trades table */}
      {trades.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-2">Sin trades aún — el agente ejecutará su primera orden cuando detecte una oportunidad.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-zinc-500 border-b border-zinc-700">
              <tr>
                <th className="pb-2 pr-3">Fecha</th>
                <th className="pb-2 pr-3">Tipo</th>
                <th className="pb-2 pr-3">Mercado</th>
                <th className="pb-2 pr-3">Lado</th>
                <th className="pb-2 pr-3 text-right">Precio</th>
                <th className="pb-2 pr-3 text-right">Tamaño</th>
                <th className="pb-2 pr-3 text-right">P&L</th>
                <th className="pb-2 pr-3 text-right">Fee</th>
                <th className="pb-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {trades.map((t) => {
                const isWin = t.pnl_usd != null && t.pnl_usd > 0;
                const isLoss = t.pnl_usd != null && t.pnl_usd < 0;
                const typeBadge =
                  t.trade_type === 'EXIT' ? { label: 'EXIT', cls: 'bg-purple-900/50 text-purple-300' }
                  : t.trade_type === 'SIMULATED' ? { label: 'SIM', cls: 'bg-blue-900/50 text-blue-300' }
                  : { label: 'BUY', cls: 'bg-cyan-900/50 text-cyan-300' };
                return (
                  <tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">
                      {new Date(t.executed_at).toLocaleDateString()} {new Date(t.executed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge.cls}`}>{typeBadge.label}</span>
                    </td>
                    <td className="py-2 pr-3 truncate max-w-[140px]">{t.market_slug}</td>
                    <td className="py-2 pr-3">
                      <span className={t.side === "BUY" ? "text-green-400" : "text-red-400"}>{t.side}</span>
                      {" "}<span className="text-zinc-500">{t.outcome}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt(t.price, 4)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{t.size_usd != null ? `$${t.size_usd.toFixed(2)}` : "—"}</td>
                    <td className={`py-2 pr-3 text-right font-mono font-bold ${isWin ? "text-green-400" : isLoss ? "text-red-400" : "text-zinc-400"}`}>
                      {t.pnl_usd != null ? `${t.pnl_usd >= 0 ? "+" : ""}${t.pnl_usd.toFixed(2)}$` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-yellow-600">{t.fee_usd != null ? `-$${t.fee_usd.toFixed(3)}` : "—"}</td>
                    <td className="py-2 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        t.status === "FILLED" ? "bg-green-900/50 text-green-400"
                        : t.status === "SIMULATED" ? "bg-blue-900/50 text-blue-400"
                        : "bg-zinc-700 text-zinc-400"
                      }`}>{t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tradesTotal > trades.length && (
            <p className="text-center text-[10px] text-zinc-600 pt-2">Mostrando {trades.length} de {tradesTotal} operaciones</p>
          )}
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
