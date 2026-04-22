"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Zap, TrendingUp, Shield, Clock, AlertTriangle } from "lucide-react";

interface QuantumState {
  energy: number | null;
  bullBias: number | null;
  expectedMove: number | null;
  amplitudes: number[] | null;
  signalDirection: "BUY" | "SELL" | "SKIP" | null;
  confidence: number | null;
}

interface EngineData {
  sessionDate: string;
  updatedAt: string;
  currentEquity: number | null;
  sessionBaseEquity: number | null;
  dailyPnlPct: number | null;
  opsCount: number | null;
  kellyCurrent: number | null;
  volTarget: number | null;
  circuitBreakerTriggered: boolean;
  circuitBreakerAt: string | null;
  circuitBreakerReason: string | null;
  regimeCode: string | null;
  quantum: QuantumState;
}

interface RegimeData {
  code: string;
  confidence: number;
  detectedAt: string | null;
  strategy: string | null;
  stateProbabilities: Record<string, number> | null;
  isColdStart: boolean;
}

interface SessionData {
  active: boolean;
  session: "NY" | "LONDON" | "OVERLAP" | "CLOSED";
  minutesUntilClose: number;
}

interface EngineStateResponse {
  session: SessionData;
  engine: EngineData | null;
  regime: RegimeData | null;
}

const STATE_NAMES = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
];

const STATE_COLORS: Record<string, string> = {
  BULL_TREND_STRONG: "bg-emerald-500",
  BULL_TREND_WEAK: "bg-green-400",
  BEAR_TREND_STRONG: "bg-red-500",
  BEAR_TREND_WEAK: "bg-orange-400",
  SIDEWAYS_LOW_VOL: "bg-blue-400",
  SIDEWAYS_HIGH_VOL: "bg-yellow-400",
  BREAKOUT_IMMINENT: "bg-purple-500",
};

const REGIME_BADGE: Record<string, string> = {
  BULL_TREND_STRONG: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  BULL_TREND_WEAK: "bg-green-500/20 text-green-400 border-green-500/30",
  BEAR_TREND_STRONG: "bg-red-500/20 text-red-400 border-red-500/30",
  BEAR_TREND_WEAK: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SIDEWAYS_LOW_VOL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SIDEWAYS_HIGH_VOL: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  BREAKOUT_IMMINENT: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function Bar({
  value,
  max = 1,
  color = "bg-blue-500",
  pulse = false,
}: {
  value: number;
  max?: number;
  color?: string;
  pulse?: boolean;
}) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color} ${pulse ? "animate-pulse" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Gauge({
  value,
  label,
  min = -1,
  max = 1,
}: {
  value: number | null;
  label: string;
  min?: number;
  max?: number;
}) {
  if (value === null) {
    return (
      <div className="text-center">
        <p className="text-xs text-white/30">{label}</p>
        <p className="text-lg font-mono text-white/20 mt-1">—</p>
      </div>
    );
  }
  const range = max - min;
  const pct = ((value - min) / range) * 100;
  const color =
    value > 0.3 ? "text-emerald-400" : value < -0.3 ? "text-red-400" : "text-yellow-400";

  return (
    <div className="text-center">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`text-lg font-mono font-bold mt-1 ${color}`}>
        {value.toFixed(3)}
      </p>
      <div className="mt-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${value >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface EngineDevToolsPanelProps {
  botInstanceId: string;
}

export function EngineDevToolsPanel({ botInstanceId }: EngineDevToolsPanelProps) {
  const [data, setData] = useState<EngineStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bot/engine-state?botInstanceId=${botInstanceId}`
      );
      if (!res.ok) return;
      const json: EngineStateResponse = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      // silently fail — UI shows stale data
    } finally {
      setLoading(false);
    }
  }, [botInstanceId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10_000); // 10s polling
    return () => clearInterval(interval);
  }, [fetchState]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-sm text-white/40">Cargando engine state...</p>
        </div>
      </div>
    );
  }

  const engine = data?.engine;
  const regime = data?.regime;
  const session = data?.session;
  const q = engine?.quantum;
  const cbPct = engine ? Math.abs(engine.dailyPnlPct ?? 0) * 100 : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d14] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Engine DevTools</h3>
          <span className="text-xs text-white/30">(read-only)</span>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <span
              className={`text-xs px-2 py-0.5 rounded border ${
                session.active
                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                  : "border-white/10 text-white/30"
              }`}
            >
              {session.session}
            </span>
          )}
          {lastUpdate && (
            <span className="text-xs text-white/20">
              {lastUpdate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Circuit Breaker Alert */}
        {engine?.circuitBreakerTriggered && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-400">CIRCUIT BREAKER ACTIVO</p>
              <p className="text-xs text-red-300/60">{engine.circuitBreakerReason ?? "Pérdida diaria >25%"}</p>
            </div>
          </div>
        )}

        {/* 2-col grid: Quantum + Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── Quantum Section ─────────────────────────────────────── */}
          <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                Quantum State
              </span>
              {q?.signalDirection && (
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded font-bold ${
                    q.signalDirection === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : q.signalDirection === "SELL"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {q.signalDirection}
                </span>
              )}
            </div>

            {/* Hamiltonian Energy */}
            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Energía Hamiltoniana</span>
                <span className="font-mono text-white/60">
                  {q?.energy !== null && q?.energy !== undefined
                    ? q.energy.toExponential(3)
                    : "—"}
                </span>
              </div>
              <Bar
                value={q?.energy !== null && q?.energy !== undefined ? Math.tanh(Math.abs(q.energy) * 1e-5) : 0}
                color="bg-yellow-500"
              />
            </div>

            {/* Bull Bias / Expected Move */}
            <div className="grid grid-cols-2 gap-3">
              <Gauge value={q?.bullBias ?? null} label="Bull Bias" />
              <Gauge
                value={q?.expectedMove ?? null}
                label="Expected Move"
                min={-0.1}
                max={0.1}
              />
            </div>

            {/* Confidence */}
            {q?.confidence !== null && q?.confidence !== undefined && (
              <div>
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Confianza</span>
                  <span className="font-mono text-white/60">
                    {(q.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <Bar
                  value={q.confidence}
                  color={q.confidence > 0.7 ? "bg-emerald-500" : q.confidence > 0.5 ? "bg-yellow-500" : "bg-white/20"}
                />
              </div>
            )}

            {/* Amplitude bars */}
            {q?.amplitudes && q.amplitudes.length > 0 && (
              <div>
                <p className="text-xs text-white/30 mb-1.5">Amplitudes (|ψ|²)</p>
                <div className="flex items-end gap-1 h-8">
                  {q.amplitudes.slice(0, 8).map((a, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-blue-500/60 transition-all duration-500"
                      style={{ height: `${Math.min(a * 100, 100)}%` }}
                      title={`[${i}]: ${a.toFixed(4)}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Risk Section ─────────────────────────────────────────── */}
          <div className="space-y-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                Risk & Sizing
              </span>
            </div>

            {/* Circuit Breaker bar */}
            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Circuit Breaker (PnL diario)</span>
                <span
                  className={`font-mono ${
                    cbPct > 20 ? "text-red-400" : cbPct > 10 ? "text-orange-400" : "text-white/60"
                  }`}
                >
                  {cbPct.toFixed(1)}% / 25%
                </span>
              </div>
              <Bar
                value={cbPct}
                max={25}
                color={cbPct > 20 ? "bg-red-500" : cbPct > 10 ? "bg-orange-400" : "bg-blue-500"}
                pulse={cbPct > 20}
              />
            </div>

            {/* Kelly */}
            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Fracción Kelly</span>
                <span className="font-mono text-white/60">
                  {engine?.kellyCurrent !== null && engine?.kellyCurrent !== undefined
                    ? `${(engine.kellyCurrent * 100).toFixed(2)}%`
                    : "—"}
                </span>
              </div>
              <Bar
                value={engine?.kellyCurrent ?? 0}
                max={0.05}
                color="bg-violet-500"
              />
            </div>

            {/* Vol target */}
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Vol Target</span>
              <span className="font-mono text-white/60">
                {engine?.volTarget !== null && engine?.volTarget !== undefined
                  ? `${(engine.volTarget * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>

            {/* Equity */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Equity actual</span>
                <span className="font-mono text-white/70">
                  {engine?.currentEquity !== null && engine?.currentEquity !== undefined
                    ? `$${engine.currentEquity.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Base sesión</span>
                <span className="font-mono text-white/50">
                  {engine?.sessionBaseEquity !== null && engine?.sessionBaseEquity !== undefined
                    ? `$${engine.sessionBaseEquity.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Session + ops */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-white/30" />
                <span className="text-xs text-white/40">
                  {session?.minutesUntilClose !== undefined
                    ? `${session.minutesUntilClose}min cierre`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <TrendingUp className="h-3 w-3 text-white/30" />
                <span className="text-xs text-white/40">
                  {engine?.opsCount ?? 0} ops hoy
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── HMM Regime Section ──────────────────────────────────────── */}
        <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                Régimen HMM
              </span>
            </div>
            {regime && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${
                    REGIME_BADGE[regime.code] ?? "border-white/10 text-white/40"
                  }`}
                >
                  {regime.code.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-white/30">
                  {(regime.confidence * 100).toFixed(0)}% conf
                </span>
                {regime.isColdStart && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">
                    cold start
                  </span>
                )}
              </div>
            )}
          </div>

          {regime?.stateProbabilities ? (
            <div className="space-y-1.5">
              {STATE_NAMES.map((state) => {
                const prob =
                  (regime.stateProbabilities as Record<string, number>)[state] ?? 0;
                const isActive = state === regime.code;
                return (
                  <div key={state} className="flex items-center gap-2">
                    <span
                      className={`text-xs w-36 shrink-0 ${
                        isActive ? "text-white font-medium" : "text-white/30"
                      }`}
                    >
                      {state.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1">
                      <Bar
                        value={prob}
                        color={
                          isActive
                            ? STATE_COLORS[state] ?? "bg-white/40"
                            : "bg-white/15"
                        }
                      />
                    </div>
                    <span
                      className={`text-xs font-mono w-10 text-right ${
                        isActive ? "text-white/80" : "text-white/30"
                      }`}
                    >
                      {(prob * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : regime ? (
            <div className="text-center py-2">
              <p className="text-xs text-white/30">Sin probabilidades de estado disponibles</p>
              <p className="text-xs text-white/20 mt-0.5">
                Estrategia: {regime.strategy ?? "—"}
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-white/20 py-2">
              Sin datos de régimen para hoy
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
