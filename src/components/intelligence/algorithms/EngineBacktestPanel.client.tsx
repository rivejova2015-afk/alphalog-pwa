"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { EquityCurve } from "./EquityCurve";

interface BacktestMetrics {
  totalTrades?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  totalPnl?: number;
  totalReturnPct?: number;
  profitFactor?: number;
  expectancy?: number;
  sharpe?: number;
  sortino?: number;
  maxDrawdown?: number;
  maxDrawdownPct?: number;
  avgWin?: number;
  avgLoss?: number;
}

interface EquityRow { ts: string; equity: number; drawdown: number }

interface MonteCarloPayload {
  iterations: number;
  finalEquityPercentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  maxDrawdownPercentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  probProfitable: number;
  probRuin: number;
}

interface WalkForwardWindow {
  window: number;
  from: string;
  to: string;
  trades: number;
  pnl: number;
  winRate: number;
  sharpe: number;
  maxDrawdownPct: number;
}

interface WalkForwardPayload {
  windows: WalkForwardWindow[];
  avgSharpe: number;
  sharpeStdDev: number;
  consistency: number;
  profitableWindows: number;
}

interface BacktestResponse {
  algorithm: { id: string; name: string; status: string };
  symbol: string;
  from: string;
  to: string;
  bars_loaded: { tf: string; count: number }[];
  result: {
    metrics: BacktestMetrics;
    equityCurve: EquityRow[];
    finalBalance: number;
    durationMs: number;
    trades: { id: number; side: string; pnl: number }[];
  };
  monte_carlo: MonteCarloPayload | null;
  walk_forward: WalkForwardPayload | null;
}

interface Props {
  algorithmId: string;
  instruments: string[];
}

function rangeDefault(daysBack: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function formatPct(v: number | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function formatNum(v: number | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function EngineBacktestPanel({ algorithmId, instruments }: Props) {
  const defaults = rangeDefault(90);
  const [symbol, setSymbol]           = useState(instruments[0] ?? "XAUUSD");
  const [from, setFrom]               = useState(defaults.from);
  const [to, setTo]                   = useState(defaults.to);
  const [startingEquity, setStarting] = useState("10000");
  const [slAtrMult, setSl]            = useState("1.5");
  const [tpAtrMult, setTp]            = useState("3.0");
  const [mcIters, setMcIters]         = useState("0");
  const [wfWindows, setWfWindows]     = useState("0");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [data, setData]               = useState<BacktestResponse | null>(null);

  async function run() {
    if (instruments.length === 0) {
      toast.error("La estrategia no tiene instrumentos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/engine-backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          from: new Date(from).toISOString(),
          to:   new Date(to).toISOString(),
          starting_equity: Number(startingEquity) || 10000,
          sl_atr_mult: Number(slAtrMult) || 1.5,
          tp_atr_mult: Number(tpAtrMult) || 3.0,
          monte_carlo_iterations: Number(mcIters) || 0,
          walk_forward_windows: Number(wfWindows) || 0,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `HTTP ${res.status}`);
        toast.error(j.error || "Backtest falló");
        return;
      }
      const json = (await res.json()) as BacktestResponse;
      setData(json);
      toast.success(`Backtest completado en ${json.result.durationMs}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const metrics = data?.result.metrics;
  const equityPoints = data?.result.equityCurve.map((p) => ({
    date: p.ts.slice(0, 10),
    equity: p.equity,
  })) ?? [];

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#a78bfa]" />
          <p className="text-xs text-[#475569] uppercase tracking-wider font-medium">Engine v1 — Backtest Validator</p>
        </div>
        {data && (
          <span className="text-[10px] font-mono text-[#475569]">{data.result.durationMs}ms · {data.result.trades.length} trades</span>
        )}
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">Símbolo</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none">
            {instruments.length === 0 && <option value="">—</option>}
            {instruments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">Equity inicial</label>
          <input type="number" value={startingEquity} onChange={(e) => setStarting(e.target.value)} step="100" min="100"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">SL × ATR</label>
          <input type="number" value={slAtrMult} onChange={(e) => setSl(e.target.value)} step="0.1" min="0.1"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">TP × ATR</label>
          <input type="number" value={tpAtrMult} onChange={(e) => setTp(e.target.value)} step="0.1" min="0.1"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1" title="0 = saltar. 500-1000 recomendado.">Monte Carlo iters</label>
          <input type="number" value={mcIters} onChange={(e) => setMcIters(e.target.value)} step="100" min="0" max="5000"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1" title="0 = saltar. 4 ventanas recomendado.">Walk-Fwd ventanas</label>
          <input type="number" value={wfWindows} onChange={(e) => setWfWindows(e.target.value)} step="1" min="0" max="12"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading || !symbol}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9474ee] text-[#0a0e1a] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Corriendo…" : "Validar Engine"}
        </button>
        {data && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#475569]">
            <CheckCircle2 size={10} className="text-[#34d399]" />
            <span className="font-mono">{data.bars_loaded.map((b) => `${b.tf}:${b.count}`).join(" · ")}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-xs">
          <AlertCircle size={12} />
          <span className="font-mono">{error}</span>
        </div>
      )}

      {data && metrics && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Metric label="Total Trades" value={String(metrics.totalTrades ?? 0)} />
            <Metric label="Win Rate"      value={formatPct(metrics.winRate)} accent="emerald" />
            <Metric label="Total PnL"     value={`$${formatNum(metrics.totalPnl)}`} accent={(metrics.totalPnl ?? 0) >= 0 ? "emerald" : "red"} />
            <Metric label="Sharpe"        value={formatNum(metrics.sharpe)} accent="cyan" />
            <Metric label="Max DD %"      value={formatPct(metrics.maxDrawdownPct)} accent="red" />
            <Metric label="Profit Factor" value={formatNum(metrics.profitFactor)} accent="cyan" />
          </div>

          {equityPoints.length > 1 && (
            <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
              <p className="text-[10px] text-[#475569] uppercase tracking-wider mb-2">Equity Curve</p>
              <EquityCurve points={equityPoints} height={120} algoId={algorithmId} />
            </div>
          )}

          {data.monte_carlo && data.monte_carlo.iterations > 0 && (
            <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-[#475569] uppercase tracking-wider">Monte Carlo · {data.monte_carlo.iterations} iters</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Metric label="Prob profitable" value={formatPct(data.monte_carlo.probProfitable)} accent="emerald" />
                <Metric label="Prob ruin" value={formatPct(data.monte_carlo.probRuin)} accent="red" />
                <Metric label="Equity p5" value={`$${formatNum(data.monte_carlo.finalEquityPercentiles.p5)}`} />
                <Metric label="Equity p95" value={`$${formatNum(data.monte_carlo.finalEquityPercentiles.p95)}`} accent="emerald" />
                <Metric label="DD p5" value={formatPct(data.monte_carlo.maxDrawdownPercentiles.p5)} />
                <Metric label="DD p50" value={formatPct(data.monte_carlo.maxDrawdownPercentiles.p50)} />
                <Metric label="DD p95" value={formatPct(data.monte_carlo.maxDrawdownPercentiles.p95)} accent="red" />
                <Metric label="Equity p50" value={`$${formatNum(data.monte_carlo.finalEquityPercentiles.p50)}`} accent="cyan" />
              </div>
            </div>
          )}

          {data.walk_forward && data.walk_forward.windows.length > 0 && (
            <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#475569] uppercase tracking-wider">Walk-Forward · {data.walk_forward.windows.length} ventanas</p>
                <div className="flex items-center gap-3 text-[10px] text-[#475569] font-mono">
                  <span>avg Sharpe: <span className="text-[#22d3ee]">{formatNum(data.walk_forward.avgSharpe)}</span></span>
                  <span>±{formatNum(data.walk_forward.sharpeStdDev)}</span>
                  <span>consistency: <span className="text-[#34d399]">{formatPct(data.walk_forward.consistency)}</span></span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead className="text-[#475569]">
                    <tr>
                      <th className="text-left py-1 px-2">#</th>
                      <th className="text-left py-1 px-2">Desde</th>
                      <th className="text-left py-1 px-2">Hasta</th>
                      <th className="text-right py-1 px-2">Trades</th>
                      <th className="text-right py-1 px-2">PnL</th>
                      <th className="text-right py-1 px-2">Win Rate</th>
                      <th className="text-right py-1 px-2">Sharpe</th>
                      <th className="text-right py-1 px-2">Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.walk_forward.windows.map((w) => (
                      <tr key={w.window} className="border-t border-[#1f2937]">
                        <td className="py-1 px-2">{w.window}</td>
                        <td className="py-1 px-2">{w.from.slice(0, 10)}</td>
                        <td className="py-1 px-2">{w.to.slice(0, 10)}</td>
                        <td className="py-1 px-2 text-right">{w.trades}</td>
                        <td className={`py-1 px-2 text-right ${w.pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>${formatNum(w.pnl)}</td>
                        <td className="py-1 px-2 text-right">{formatPct(w.winRate)}</td>
                        <td className="py-1 px-2 text-right text-[#22d3ee]">{formatNum(w.sharpe)}</td>
                        <td className="py-1 px-2 text-right text-[#ef4444]">{formatPct(w.maxDrawdownPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "red" | "cyan" }) {
  const color = accent === "emerald" ? "#34d399"
              : accent === "red"     ? "#ef4444"
              : accent === "cyan"    ? "#22d3ee"
              : "#e2e8f0";
  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-2">
      <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  );
}
