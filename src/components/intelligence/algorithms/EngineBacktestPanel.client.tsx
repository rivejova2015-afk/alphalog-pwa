"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, History, Brain, ShieldCheck, XCircle, ArrowUpCircle, Database, Trash2, Info, Wand2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useBacktestStream, type BacktestPhaseEvent } from "@/hooks/useBacktestStream";
import { useAutoTuneStream, type AutoTuneTrial } from "@/hooks/useAutoTuneStream";

/**
 * Render the SSE phase event as a short Spanish label for the inline status
 * line. Kept here (not in the hook) because the copy is product-facing.
 */
function formatPhaseLabel(ev: BacktestPhaseEvent): string {
  switch (ev.phase) {
    case "baseline":
      return ev.step === "start" ? "Corriendo baseline…" : "Baseline listo";
    case "monte_carlo":
      if (ev.step === "start") return `Monte Carlo (${ev.total ?? "?"} iters)…`;
      if (ev.step === "progress" && ev.current && ev.total) return `Monte Carlo ${ev.current}/${ev.total}`;
      return "Monte Carlo listo";
    case "walk_forward":
      if (ev.step === "start") return `Walk-forward (${ev.total ?? "?"} ventanas)…`;
      if (ev.step === "progress" && ev.current && ev.total) return `Walk-forward ventana ${ev.current}/${ev.total}`;
      return "Walk-forward listo";
    case "done":
      return "Persistiendo resultados…";
  }
}
import { EquityCurve } from "./EquityCurve";
import { Mt5BarsImport } from "./Mt5BarsImport.client";

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

interface GateResult {
  key: string;
  label: string;
  tier: "must" | "should";
  value: number | null;
  passed: boolean;
}

interface GateEvaluation {
  results: GateResult[];
  mustPassed: number;
  mustTotal: number;
  shouldPassed: number;
  shouldTotal: number;
  allMustPassed: boolean;
  eligibleForPaper: boolean;
}

interface AdvancedPayload {
  ml:        { used: true; trainAcc: number; validAcc: number; featureNames: string[] } | null;
  multiTf:
    | { used: true; status: 'pending';   higherTimeframes: string[] }
    | { used: true; status: 'completed'; higherTimeframes: string[]; tradesFilteredCount: number; alignment: { byTf: Record<string, { bull: number; bear: number; neutral: number }>; totalPrimaryBars: number } }
    | { used: true; status: 'failed';    higherTimeframes: string[]; reason: string }
    | null;
  portfolio:
    | { used: true; status: "pending";   reason: string }
    | { used: true; status: "completed"; legCount: number; metrics: { totalPnl: number; totalReturnPct: number; sharpe: number; maxDrawdown: number; maxDrawdownPct: number; legCorrelations: { a: string; b: string; rho: number }[] }; equityPreviewLast50: { ts: string; equity: number; drawdown: number }[] }
    | { used: true; status: "failed";    reason: string }
    | null;
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
  advanced?: AdvancedPayload | null;
  advanced_warnings?: string[];
  gates?: GateEvaluation | null;
  promoted?: boolean;
  run_id?: string | null;
  created_at?: string | null;
}

interface SymbolStatus {
  assetClass: string;
  apiCoverage: boolean;
  totalBars: number;
  barsByTf: Record<string, number>;
  sourcesUsed: string[];
  hasAnyData: boolean;
  nextSteps: string[];
  notes?: string;
}

interface HistoryRow {
  id: string;
  symbol: string;
  range_from: string;
  range_to: string;
  params: Record<string, unknown>;
  baseline_metrics: BacktestMetrics;
  equity_curve: EquityRow[];
  final_balance: number | null;
  total_trades: number | null;
  duration_ms: number | null;
  monte_carlo: MonteCarloPayload | null;
  walk_forward: WalkForwardPayload | null;
  bars_loaded: { tf: string; count: number }[];
  advanced: AdvancedPayload | null;
  created_at: string;
}

// Higher-is-better for every metric except drawdown.
const LOWER_IS_BETTER = new Set(["maxDrawdownPct", "maxDrawdown", "avgLoss"]);

interface Props {
  algorithmId: string;
  instruments: string[];
  // Research-mode props: when the algorithm has no cuenta vinculada
  // (linkedBotAccountId === null), the panel prompts for an initial capital
  // explicitly. defaultBacktestBalance prefills that input; null falls back to
  // $10K. Both safe to omit — defaults preserve the previous behaviour.
  linkedBotAccountId?: string | null;
  defaultBacktestBalance?: number | null;
}

// Quick presets shown above the capital input in research mode. Click sets
// the input to that value. Ordered ascending. Tweak freely — no DB impact.
const CAPITAL_PRESETS: { label: string; value: number }[] = [
  { label: "$1K",   value: 1_000   },
  { label: "$10K",  value: 10_000  },
  { label: "$50K",  value: 50_000  },
  { label: "$100K", value: 100_000 },
  { label: "$250K", value: 250_000 },
];

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

export function EngineBacktestPanel({
  algorithmId,
  instruments,
  linkedBotAccountId = null,
  defaultBacktestBalance = null,
}: Props) {
  const defaults = rangeDefault(90);
  const isResearchMode = linkedBotAccountId === null;
  // Initial capital prefill: persisted default first, then $10K fallback.
  // Saved as string so the controlled <input type=number> stays happy.
  const initialEquity = defaultBacktestBalance != null && defaultBacktestBalance > 0
    ? String(defaultBacktestBalance)
    : "10000";
  const [symbol, setSymbol]           = useState(instruments[0] ?? "XAUUSD");
  const [from, setFrom]               = useState(defaults.from);
  const [to, setTo]                   = useState(defaults.to);
  const [startingEquity, setStarting] = useState(initialEquity);
  // True when the user changed the value vs the persisted default — used to
  // surface "Guardar como default" only when there's something new to save.
  const [savingDefault, setSavingDefault] = useState(false);
  const [slAtrMult, setSl]            = useState("1.5");
  const [tpAtrMult, setTp]            = useState("3.0");
  const [mcIters, setMcIters]         = useState("0");
  // Walk-forward defaults to 4 windows (opt-out): every backtest validates
  // consistency across 4 time slices to catch overfit. 0 disables it. The
  // engine v1 silently returns {windows:[],...} when bars < 200*windows so
  // the UI surfaces a warning in that case (see below near results render).
  const [wfWindows, setWfWindows]     = useState("4");
  const [useMl, setUseMl]             = useState(false);
  // Multi-TF and Portfolio toggles are disabled in the sync flow on purpose
  // (see Gap #4 hardening). Engine v1's SMC funnel already evaluates D1 → H1
  // → M15 → M1, so an extra higher-TF filter would be redundant; the portfolio
  // backtest needs SupabaseClient + per-leg legs editor which only live in the
  // async flow. The toggles stay visible (with a disabled badge + tooltip) so
  // users can discover the feature, but the wire-up always sends false here.
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [data, setData]               = useState<BacktestResponse | null>(null);
  // SSE streaming hook — drives the live "Running baseline..." / "Walk-forward
  // 3/5" text under the Run button while the backtest is in flight. Falls
  // back to the JSON path when the user disables streaming or when SSE fails
  // mid-flight (see runJsonFallback below).
  const stream = useBacktestStream<BacktestResponse>();
  const [history, setHistory]         = useState<HistoryRow[]>([]);
  const [trainingMl, setTrainingMl]   = useState(false);
  const [mlStatus, setMlStatus]       = useState<string | null>(null);
  const [compareIds, setCompareIds]   = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [manageOpen, setManageOpen]   = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HistoryRow | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [symbolStatus, setSymbolStatus] = useState<Record<string, SymbolStatus> | null>(null);

  // Auto-tune SL/TP grid (Mejora #6). The hook streams per-trial results;
  // the modal stays open until the user closes it or applies the best combo.
  const autoTune = useAutoTuneStream();
  const [autoTuneOpen, setAutoTuneOpen] = useState(false);
  const [savingTune, setSavingTune] = useState(false);

  // Load history on mount + refresh after each successful run.
  const refreshHistory = async () => {
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/engine-backtest/history?limit=20`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json() as { runs: HistoryRow[] };
      setHistory(json.runs ?? []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    refreshHistory();
  }, [algorithmId]);

  // Open the auto-tune panel as soon as the stream starts. Without this,
  // launching the tune programmatically (e.g. via hook from tests) or via
  // a clicker that didn't toggle autoTuneOpen would leave the panel hidden.
  useEffect(() => {
    if (autoTune.isStreaming) setAutoTuneOpen(true);
  }, [autoTune.isStreaming]);

  function loadRun(run: HistoryRow) {
    // Reconstruct a BacktestResponse-shaped payload from the stored row so
    // the UI re-renders without a fresh sim. Trades + equity curve aren't
    // persisted (heavy + bounded value) — we leave them empty.
    setData({
      algorithm: { id: algorithmId, name: "", status: "" },
      symbol: run.symbol,
      from: run.range_from,
      to:   run.range_to,
      bars_loaded: run.bars_loaded ?? [],
      result: {
        metrics: run.baseline_metrics,
        equityCurve: run.equity_curve ?? [],
        finalBalance: run.final_balance ?? 0,
        durationMs: run.duration_ms ?? 0,
        trades: [],
      },
      monte_carlo: run.monte_carlo,
      walk_forward: run.walk_forward,
      advanced: run.advanced,
      run_id: run.id,
      created_at: run.created_at,
    });
    setError(null);
    toast.message(`Cargado run del ${new Date(run.created_at).toLocaleString()}`);
  }

  function toggleCompare(runId: string) {
    setCompareIds((prev) => {
      if (prev.includes(runId)) return prev.filter((x) => x !== runId);
      // FIFO of 3: keep the 2 newest + the just-clicked one when at cap.
      if (prev.length >= 3) return [prev[1], prev[2], runId];
      return [...prev, runId];
    });
  }

  async function deleteAllRuns() {
    setDeletingAll(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/engine-backtest/runs`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      toast.success(`${json.deleted ?? 0} backtests borrados`);
      setCompareIds([]);
      setData(null);
      await refreshHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setDeletingAll(false);
      setConfirmDeleteAll(false);
    }
  }

  async function saveAsDefault() {
    const value = Number(startingEquity);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Capital inválido");
      return;
    }
    setSavingDefault(true);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_backtest_balance: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      toast.success(`Default actualizado: $${value.toLocaleString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setSavingDefault(false);
    }
  }

  async function deleteRun(runId: string) {
    setDeletingId(runId);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/engine-backtest/runs/${runId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      toast.success("Backtest borrado");
      // Drop from compare + clear the currently-loaded view if it was the deleted one.
      setCompareIds((prev) => prev.filter((id) => id !== runId));
      if (data?.run_id === runId) setData(null);
      await refreshHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  const compareRuns = compareIds
    .map((cid) => history.find((h) => h.id === cid))
    .filter((r): r is HistoryRow => r != null);

  async function bootstrapBars() {
    if (instruments.length === 0) {
      toast.error("La estrategia no tiene instrumentos");
      return;
    }
    setBootstrapping(true);
    setBootstrapStatus(null);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/bars-bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Bootstrap falló");
        setBootstrapStatus(`error: ${json.error ?? "unknown"}`);
        return;
      }

      // Capture per-symbol status from the registry-driven response.
      // Used to render the data availability panel below the form.
      if (json.symbol_status) setSymbolStatus(json.symbol_status as Record<string, SymbolStatus>);

      // Auto-align the form date range to what Yahoo actually returned for the
      // currently-selected symbol. We take the intersection across the 4 TFs:
      // the latest `from` and the earliest `to` — that's the window where ALL
      // TFs have data, so the funnel can evaluate every step. Without this
      // the user is left guessing why the backtest returns 0 trades.
      interface BootstrapRow {
        symbol: string;
        tf: string;
        bars: number;
        from_ts: string | null;
        to_ts: string | null;
        error?: string;
      }
      const rowsForSymbol: BootstrapRow[] = (json.summary ?? []).filter(
        (r: BootstrapRow) => r.symbol === symbol && r.bars > 0,
      );
      let synced = "";
      if (rowsForSymbol.length === 4) {
        const fromTs = rowsForSymbol
          .map((r) => new Date(r.from_ts ?? "").getTime())
          .reduce((a, b) => Math.max(a, b));
        const toTs = rowsForSymbol
          .map((r) => new Date(r.to_ts ?? "").getTime())
          .reduce((a, b) => Math.min(a, b));
        if (Number.isFinite(fromTs) && Number.isFinite(toTs) && toTs > fromTs) {
          const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
          setFrom(fmt(fromTs));
          setTo(fmt(toTs));
          synced = ` · rango aplicado: ${fmt(fromTs)} → ${fmt(toTs)}`;
        }
      }
      const errs = json.errors > 0 ? ` · ${json.errors} errores` : "";
      toast.success(`Data lista: ${json.total_bars} barras en ${(json.duration_ms / 1000).toFixed(1)}s${errs}`);

      // Detail line — bars per TF for the current symbol, so the user sees
      // what Yahoo actually delivered before clicking Validar.
      const perTfDetail = rowsForSymbol.length > 0
        ? rowsForSymbol.map((r) => `${r.tf}:${r.bars}`).join(" · ")
        : "(sin data para este símbolo)";
      setBootstrapStatus(`${json.total_bars} bars total · ${symbol}: ${perTfDetail}${synced}${errs}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      toast.error(msg);
      setBootstrapStatus(`error: ${msg}`);
    } finally {
      setBootstrapping(false);
    }
  }

  async function trainMl() {
    if (instruments.length === 0) {
      toast.error("La estrategia no tiene instrumentos");
      return;
    }
    setTrainingMl(true);
    setMlStatus(null);
    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/ml-train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe: "M15", lookback_days: 180, epochs: 200 }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Entrenamiento falló");
        setMlStatus(`error: ${json.error ?? "unknown"}`);
        return;
      }
      toast.success(`Modelo entrenado · train ${(json.train_acc * 100).toFixed(1)}% / valid ${(json.valid_acc * 100).toFixed(1)}%`);
      setMlStatus(`Entrenado: train ${(json.train_acc * 100).toFixed(1)}% · valid ${(json.valid_acc * 100).toFixed(1)}% · ${json.bars_used} bars`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      toast.error(msg);
      setMlStatus(`error: ${msg}`);
    } finally {
      setTrainingMl(false);
    }
  }

  // Auto-tune SL/TP grid (Mejora #6). Streams ~29 trials over SSE, ranks by
  // Sharpe (tie-break on totalPnl), shows progress + top 5 in a modal, and
  // optionally writes the best combo to algorithms.parameters under
  // `sl_atr_mult_recommended` / `tp_atr_mult_recommended` namespaces.
  function startAutoTune() {
    if (instruments.length === 0) {
      toast.error("La estrategia no tiene instrumentos");
      return;
    }
    if (!symbol) {
      toast.error("Elegí un símbolo primero");
      return;
    }
    autoTune.reset();
    setAutoTuneOpen(true);
    autoTune.start(`/api/algorithms/${algorithmId}/engine-backtest/auto-tune`, {
      symbol,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      starting_equity: Number(startingEquity) || 10_000,
    });
  }

  async function applyAutoTuneBest() {
    const best = autoTune.best;
    if (!best) return;
    setSavingTune(true);
    try {
      // PUT /api/algorithms/[id] replaces `parameters` wholesale, so we
      // fetch the current value first and merge the auto-tune keys into it.
      // Without this, the kelly_* / arb_gap_min / multi-tf weights would
      // disappear after a single Apply click.
      const currentRes = await fetch(`/api/algorithms/${algorithmId}`, { cache: "no-store" });
      let currentParams: Record<string, unknown> = {};
      if (currentRes.ok) {
        const cur = await currentRes.json().catch(() => ({}));
        currentParams = (cur?.algorithm?.parameters as Record<string, unknown> | undefined) ?? (cur?.parameters as Record<string, unknown> | undefined) ?? {};
      }
      const mergedParams = {
        ...currentParams,
        sl_atr_mult_recommended: best.slAtrMult,
        tp_atr_mult_recommended: best.tpAtrMult,
        auto_tune_best_sharpe:   best.sharpe,
        auto_tune_run_at:        new Date().toISOString(),
      };
      const res = await fetch(`/api/algorithms/${algorithmId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: mergedParams }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `HTTP ${res.status}`);
        return;
      }
      // Update the live inputs so the next Validar Engine uses the best combo.
      setSl(String(best.slAtrMult));
      setTp(String(best.tpAtrMult));
      toast.success(`Aplicado: SL=${best.slAtrMult} TP=${best.tpAtrMult} (Sharpe ${best.sharpe.toFixed(2)})`);
      setAutoTuneOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setSavingTune(false);
    }
  }

  function run() {
    if (instruments.length === 0) {
      toast.error("La estrategia no tiene instrumentos");
      return;
    }
    setError(null);
    setData(null);
    stream.start(
      `/api/algorithms/${algorithmId}/engine-backtest?stream=true`,
      {
        symbol,
        from: new Date(from).toISOString(),
        to:   new Date(to).toISOString(),
        starting_equity: Number(startingEquity) || 10000,
        sl_atr_mult: Number(slAtrMult) || 1.5,
        tp_atr_mult: Number(tpAtrMult) || 3.0,
        monte_carlo_iterations: Number(mcIters) || 0,
        walk_forward_windows: Number(wfWindows) || 0,
        use_ml: useMl,
        use_multi_tf: false,
        use_portfolio: false,
      },
    );
  }

  // Bridge the streaming hook into the existing setData/setError/toast UX.
  // Keeping these as effects (instead of plumbing the hook directly into the
  // render) lets the rest of the component stay unchanged: the chart and
  // tables still read from `data`, error banner from `error`, etc.
  useEffect(() => {
    setLoading(stream.isStreaming);
  }, [stream.isStreaming]);

  useEffect(() => {
    if (stream.error) {
      setError(stream.error);
      toast.error(stream.error);
    }
  }, [stream.error]);

  useEffect(() => {
    if (stream.result) {
      setData(stream.result);
      toast.success(`Backtest completado en ${stream.result.result.durationMs}ms`);
      if (stream.result.promoted) {
        toast.success("Estrategia promovida a Paper — pasó todos los quality gates");
      }
      refreshHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.result]);

  const metrics = data?.result.metrics;
  const equityPoints = data?.result.equityCurve.map((p) => ({
    date: p.ts.slice(0, 10),
    equity: p.equity,
  })) ?? [];

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4 space-y-4">
      {/* Stats isolation banner — backtest never bleeds into algorithm.pnl_today/win_rate */}
      <div className="flex items-start gap-2 rounded border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-3 py-1.5">
        <Info size={11} className="text-[#22d3ee] mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-[#22d3ee] uppercase tracking-wider font-mono">
          Resultados de backtest — no afectan las estadísticas reales del algoritmo
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#a78bfa]" />
          <p className="text-xs text-[#475569] uppercase tracking-wider font-medium">Engine v1 — Backtest Validator</p>
        </div>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <div className="flex items-center gap-1.5">
              <History size={11} className="text-[#475569]" />
              <select
                value=""
                onChange={(e) => {
                  const run = history.find((h) => h.id === e.target.value);
                  if (run) loadRun(run);
                }}
                className="rounded-md bg-[#0a0e1a] border border-[#1f2937] text-[#94a3b8] text-[10px] px-2 py-1 focus:outline-none font-mono"
              >
                <option value="">Cargar run anterior ({history.length})…</option>
                {history.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.created_at).toLocaleString()} · {r.symbol} · {r.total_trades ?? 0}tr · ${Number(r.final_balance ?? 0).toFixed(0)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setManageOpen((o) => !o)}
                title="Administrar historial (borrar runs)"
                aria-label="Administrar historial de backtests"
                aria-expanded={manageOpen}
                className={`p-1 rounded transition-colors ${manageOpen ? "text-[#ef4444] bg-[#ef4444]/10" : "text-[#475569] hover:text-[#ef4444]"}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
          {data && (
            <span className="text-[10px] font-mono text-[#475569]">{data.result.durationMs}ms · {data.result.trades.length} trades</span>
          )}
        </div>
      </div>

      {/* Manage history panel — list with delete buttons */}
      {manageOpen && history.length > 0 && (
        <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-2 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <p className="text-[10px] text-[#475569] uppercase tracking-wider">
              Borrar runs individualmente (hard-delete, sin papelera)
            </p>
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={deletingAll || history.length === 0}
              className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors disabled:opacity-40"
              title="Borrar todo el historial de backtests para este algoritmo"
            >
              {deletingAll ? "Borrando…" : `Borrar todo (${history.length})`}
            </button>
          </div>
          <div className="space-y-1">
            {history.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#151b28]">
                <span className="text-[10px] font-mono text-[#94a3b8] flex-1 truncate">
                  {new Date(r.created_at).toLocaleString()} · {r.symbol} · {r.total_trades ?? 0}tr · ${Number(r.final_balance ?? 0).toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(r)}
                  disabled={deletingId === r.id}
                  className="p-1 rounded text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors disabled:opacity-40"
                  aria-label={`Borrar backtest del ${new Date(r.created_at).toLocaleString()}`}
                  title="Borrar este run"
                >
                  {deletingId === r.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => deletingId !== confirmDelete.id && setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0a0e1a] border border-[#ef4444]/40 rounded-lg p-5 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 id="confirm-delete-title" className="text-sm font-bold text-[#ef4444] mb-2 flex items-center gap-2">
              <Trash2 size={14} /> Borrar este backtest
            </h3>
            <p className="text-[11px] text-[#94a3b8] mb-3">
              <span className="font-mono">{new Date(confirmDelete.created_at).toLocaleString()}</span> ·
              <span className="font-mono"> {confirmDelete.symbol}</span> ·
              <span className="font-mono"> {confirmDelete.total_trades ?? 0} trades</span> ·
              <span className="font-mono"> ${Number(confirmDelete.final_balance ?? 0).toFixed(0)}</span>
            </p>
            <p className="text-[10px] text-[#475569] mb-4">
              El run se borra de forma definitiva — no hay papelera. Las estadísticas reales del algoritmo no se ven afectadas.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
                className="px-3 py-1.5 rounded-lg border border-[#1f2937] text-[#475569] text-xs hover:border-[#475569] transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteRun(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
                className="px-3 py-1.5 rounded-lg bg-[#ef4444] text-white text-xs font-semibold hover:bg-[#dc2626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {deletingId === confirmDelete.id
                  ? <><Loader2 size={11} className="animate-spin" /> Borrando…</>
                  : <><Trash2 size={11} /> Borrar definitivamente</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-delete confirmation modal */}
      {confirmDeleteAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-all-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deletingAll && setConfirmDeleteAll(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0a0e1a] border border-[#ef4444]/40 rounded-lg p-5 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 id="confirm-delete-all-title" className="text-sm font-bold text-[#ef4444] mb-2 flex items-center gap-2">
              <Trash2 size={14} /> Borrar todo el historial
            </h3>
            <p className="text-[11px] text-[#94a3b8] mb-3">
              Se van a borrar <span className="font-mono font-bold text-[#ef4444]">{history.length}</span> backtest runs de este algoritmo de forma definitiva.
            </p>
            <p className="text-[10px] text-[#475569] mb-4">
              No hay papelera. Las estadísticas reales del algoritmo no se ven afectadas.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                disabled={deletingAll}
                className="px-3 py-1.5 rounded-lg border border-[#1f2937] text-[#475569] text-xs hover:border-[#475569] transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteAllRuns}
                disabled={deletingAll}
                className="px-3 py-1.5 rounded-lg bg-[#ef4444] text-white text-xs font-semibold hover:bg-[#dc2626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {deletingAll
                  ? <><Loader2 size={11} className="animate-spin" /> Borrando…</>
                  : <><Trash2 size={11} /> Borrar todos los {history.length}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MT5 CSV import — broker-fidelity data, beats Yahoo on collision */}
      <Mt5BarsImport
        algorithmId={algorithmId}
        onSuccess={() => {
          // Refresh history (a fresh backtest will see the new bars) and clear
          // any cached bootstrap status so the user re-runs Bootstrap on
          // demand. The form date range stays as-is — the user usually wants
          // to re-pick after importing a wider window.
          refreshHistory();
          setBootstrapStatus(null);
          setSymbolStatus(null);
        }}
      />

      {/* Compare: pick up to 3 runs from history */}
      {history.length >= 2 && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#475569] uppercase tracking-wider">Comparar runs — elige hasta 3</p>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 12).map((r) => {
              const selected = compareIds.includes(r.id);
              return (
                <span
                  key={r.id}
                  className={`inline-flex items-center rounded-md border text-[10px] font-mono transition-all overflow-hidden ${
                    selected
                      ? "border-[#a78bfa] bg-[#a78bfa]/10 text-[#a78bfa]"
                      : "border-[#1f2937] bg-[#0a0e1a] text-[#475569] hover:border-[#2d3748]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCompare(r.id)}
                    className="px-2 py-1"
                  >
                    {new Date(r.created_at).toLocaleDateString()} · {r.symbol} · ${Number(r.final_balance ?? 0).toFixed(0)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(r)}
                    title="Borrar este run"
                    aria-label={`Borrar backtest del ${new Date(r.created_at).toLocaleString()}`}
                    className="px-1.5 py-1 border-l border-current/30 text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                  >
                    <Trash2 size={9} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {compareRuns.length >= 2 && (
        <CompareView runs={compareRuns} algorithmId={algorithmId} />
      )}

      {/* Research-mode capital banner — only when the algorithm has no cuenta
          vinculada. Lets the user pick a fictional starting capital with
          one-tap presets and optionally persist it as the algorithm default.
          The detailed input below (in the grid) stays as the fine-grained
          control; this banner just makes the choice obvious. */}
      {isResearchMode && (
        <div className="rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[11px] font-mono font-bold text-[#a78bfa] uppercase tracking-wider">
                Modo research — sin cuenta vinculada
              </p>
              <p className="text-[10px] text-[#94a3b8] mt-0.5">
                Elegí un capital ficticio para evaluar la estrategia. Podés vincular una cuenta real después desde el detalle del algoritmo.
              </p>
            </div>
            {savingDefault ? (
              <span className="text-[10px] text-[#475569]">Guardando…</span>
            ) : (
              defaultBacktestBalance != null && Number(startingEquity) !== defaultBacktestBalance && (
                <button
                  type="button"
                  onClick={saveAsDefault}
                  className="text-[10px] font-mono text-[#a78bfa] hover:text-[#c4b5fd] transition-colors underline-offset-2 hover:underline"
                >
                  Guardar como default
                </button>
              )
            )}
            {savingDefault === false && defaultBacktestBalance == null && Number(startingEquity) > 0 && (
              <button
                type="button"
                onClick={saveAsDefault}
                className="text-[10px] font-mono text-[#a78bfa] hover:text-[#c4b5fd] transition-colors underline-offset-2 hover:underline"
              >
                Guardar como default
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1.5">
              Capital inicial ($)
            </label>
            <input
              type="number"
              value={startingEquity}
              onChange={(e) => setStarting(e.target.value)}
              step="100"
              min="100"
              className="w-full rounded-lg bg-[#0a0e1a] border border-[#a78bfa]/40 text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#a78bfa] font-mono"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {CAPITAL_PRESETS.map((p) => {
              const active = Number(startingEquity) === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setStarting(String(p.value))}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border transition-colors ${
                    active
                      ? "border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa]"
                      : "border-[#1f2937] bg-transparent text-[#475569] hover:border-[#a78bfa]/40 hover:text-[#94a3b8]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1" title="Valida consistencia partiendo el rango en N ventanas independientes. 4 por default; 0 desactiva. Requiere ≥200 bars × N.">Walk-forward (auto)</label>
          <input type="number" value={wfWindows} onChange={(e) => setWfWindows(e.target.value)} step="1" min="0" max="12"
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none" />
        </div>
      </div>

      <div className="border border-[#1f2937] rounded-lg p-3 space-y-2" data-testid="advanced-toggles">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={11} className="text-[#a78bfa]" />
          <p className="text-[10px] text-[#475569] uppercase tracking-wider font-medium">Pipeline avanzado · solo ML disponible en sync</p>
        </div>
        <p className="text-[10px] text-[#475569]">
          Multi-TF y Portfolio viven en el flujo async — abrí <span className="font-mono text-[#06b6d4]">Backtest &amp; Validation</span> para configurarlos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <label className="flex items-start gap-2 cursor-pointer" title="Logreg sobre features técnicas (RSI, ATR, EMA spread) con label de retorno forward.">
            <input
              type="checkbox"
              checked={useMl}
              onChange={(e) => setUseMl(e.target.checked)}
              className="mt-0.5 accent-[#a78bfa]"
              data-testid="toggle-use-ml"
            />
            <span className="text-[11px] text-[#cbd5e1]">
              <span className="font-medium">ML signal</span>
              <span className="block text-[10px] text-[#475569]">Train/valid acc + feature names</span>
            </span>
          </label>
          <label className="flex items-start gap-2 opacity-50 cursor-not-allowed" title="Engine v1 ya evalúa el funnel D1 → H1 → M15 → M1 nativamente. El filtro de TF superior solo aplica al engine genérico del flujo async.">
            <input
              type="checkbox"
              checked={false}
              disabled
              readOnly
              className="mt-0.5 accent-[#a78bfa]"
              data-testid="toggle-use-multi-tf"
            />
            <span className="text-[11px] text-[#cbd5e1]">
              <span className="font-medium">Multi-TF</span>
              <span className="block text-[9px] text-[#fbbf24] uppercase tracking-wide">ya integrado en SMC funnel</span>
            </span>
          </label>
          <label className="flex items-start gap-2 opacity-50 cursor-not-allowed" title="Multi-símbolo necesita editor de legs + SupabaseClient. Disponible en /algorithms/[id] → Backtest & Validation.">
            <input
              type="checkbox"
              checked={false}
              disabled
              readOnly
              className="mt-0.5 accent-[#a78bfa]"
              data-testid="toggle-use-portfolio"
            />
            <span className="text-[11px] text-[#cbd5e1]">
              <span className="font-medium">Portfolio</span>
              <span className="block text-[9px] text-[#fbbf24] uppercase tracking-wide">solo en flujo async</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={loading || !symbol}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9474ee] text-[#0a0e1a] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Corriendo…" : "Validar Engine"}
        </button>
        <button
          type="button"
          onClick={bootstrapBars}
          disabled={bootstrapping || instruments.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1f2937] border border-[#22d3ee]/30 text-[#22d3ee] text-xs font-bold transition-all hover:border-[#22d3ee]/60 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Trae el histórico Yahoo para los 4 TFs del funnel: D1 = 1 año, H1 = 90d, M15 = 30d, M1 = 6d. Primera vez puede tardar ~30s."
        >
          {bootstrapping ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
          {bootstrapping ? "Cargando data…" : "Bootstrap data"}
        </button>
        <button
          type="button"
          onClick={trainMl}
          disabled={trainingMl || !symbol}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1f2937] border border-[#a78bfa]/30 text-[#a78bfa] text-xs font-bold transition-all hover:border-[#a78bfa]/60 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Entrena un modelo logreg sobre los últimos 180 días de M15. Se aplica como overlay en live polling."
        >
          {trainingMl ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
          {trainingMl ? "Entrenando…" : "Entrenar ML"}
        </button>
        <button
          type="button"
          onClick={startAutoTune}
          disabled={autoTune.isStreaming || !symbol}
          data-testid="auto-tune-button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1f2937] border border-[#fbbf24]/30 text-[#fbbf24] text-xs font-bold transition-all hover:border-[#fbbf24]/60 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Grid search SL [1.0–3.0] × TP [2.0–5.0] step 0.5. Skipea TP≤SL. ~29 combos, ~30s con SSE streaming."
        >
          {autoTune.isStreaming ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {autoTune.isStreaming ? `Tuning ${autoTune.progress?.current ?? 0}/${autoTune.progress?.total ?? "?"}…` : "Auto-tune SL/TP"}
        </button>
        {bootstrapStatus && (
          <span className="text-[10px] font-mono text-[#475569]">{bootstrapStatus}</span>
        )}
        {mlStatus && (
          <span className="text-[10px] font-mono text-[#475569]">{mlStatus}</span>
        )}
        {/* Live phase progress from the SSE stream. Replaces the silent wait
            that previously made the backtest "feel hung" — the user now sees
            which phase is running, and Monte Carlo / Walk-Forward also show
            current/total iterations. */}
        {stream.isStreaming && stream.phase && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#a78bfa]" aria-live="polite">
            <Loader2 size={10} className="animate-spin" />
            {formatPhaseLabel(stream.phase)}
          </span>
        )}
        {data && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#475569]">
            <CheckCircle2 size={10} className="text-[#34d399]" />
            <span className="font-mono">{data.bars_loaded.map((b) => `${b.tf}:${b.count}`).join(" · ")}</span>
          </div>
        )}
      </div>

      {/* Auto-tune SL/TP panel (Mejora #6). Renders while streaming AND after
          done; lets the user inspect top 5 trials by Sharpe + apply the best
          combo to algorithms.parameters as a recommendation. */}
      {autoTuneOpen && (
        <AutoTuneResults
          isStreaming={autoTune.isStreaming}
          isDone={autoTune.isDone}
          trials={autoTune.trials}
          best={autoTune.best}
          progress={autoTune.progress}
          error={autoTune.error}
          savingTune={savingTune}
          onApply={applyAutoTuneBest}
          onClose={() => { autoTune.abort(); setAutoTuneOpen(false); }}
        />
      )}

      {/* Data availability panel — driven by the per-symbol registry. Surfaces
          actionable warnings when a symbol has zero API coverage (e.g. XAUUSD
          on Yahoo) so the user knows EXACTLY what to do, not just that
          "0 trades" happened. */}
      {symbolStatus && symbolStatus[symbol] && (() => {
        const st = symbolStatus[symbol];
        const tfs = ["D1", "H1", "M15", "M1"];
        const allEmpty = st.totalBars === 0;
        const partial  = !allEmpty && tfs.some((tf) => (st.barsByTf[tf] ?? 0) === 0);

        const tone = allEmpty
          ? { bg: "bg-[#ef4444]/5", border: "border-[#ef4444]/30", text: "text-[#ef4444]", icon: <XCircle size={12} /> }
          : partial
          ? { bg: "bg-[#f59e0b]/5", border: "border-[#f59e0b]/30", text: "text-[#f59e0b]", icon: <AlertCircle size={12} /> }
          : { bg: "bg-[#34d399]/5", border: "border-[#34d399]/30", text: "text-[#34d399]", icon: <CheckCircle2 size={12} /> };

        return (
          <div className={`rounded-lg border ${tone.border} ${tone.bg} p-3 space-y-2`}>
            <div className={`flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider ${tone.text}`}>
              {tone.icon}
              <span>Disponibilidad de data · {symbol}</span>
              <span className="text-[9px] text-[#475569] normal-case">({st.assetClass})</span>
              {st.sourcesUsed.length > 0 && (
                <span className="ml-auto text-[9px] text-[#475569] normal-case">
                  fuentes: {st.sourcesUsed.join(", ")}
                </span>
              )}
            </div>

            {/* Per-TF bar coverage chips */}
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
              {tfs.map((tf) => {
                const n = st.barsByTf[tf] ?? 0;
                const ok = n > 0;
                return (
                  <span
                    key={tf}
                    className={`px-2 py-0.5 rounded border ${
                      ok ? "border-[#34d399]/40 bg-[#34d399]/10 text-[#34d399]"
                         : "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]"
                    }`}
                  >
                    {tf}: {n.toLocaleString()}
                  </span>
                );
              })}
            </div>

            {/* Notes from registry (e.g. "Yahoo XAUUSD=X retorna 404") */}
            {st.notes && (
              <p className="text-[10px] text-[#94a3b8] italic">ⓘ {st.notes}</p>
            )}

            {/* Actionable next steps when data is missing */}
            {(allEmpty || partial) && st.nextSteps.length > 0 && (
              <div className="border-t border-current/20 pt-2 space-y-1">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
                  ¿Qué hacer ahora?
                </p>
                <ul className="space-y-0.5 text-[10px] text-[#e2e8f0]">
                  {st.nextSteps.map((step, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-[#475569]">▸</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

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

          {data.gates && (
            <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className={data.gates.allMustPassed ? "text-[#34d399]" : "text-[#f59e0b]"} />
                  <p className="text-[10px] text-[#475569] uppercase tracking-wider">
                    Quality Gates · must {data.gates.mustPassed}/{data.gates.mustTotal} · should {data.gates.shouldPassed}/{data.gates.shouldTotal}
                  </p>
                </div>
                {data.promoted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34d399]/15 border border-[#34d399]/40 text-[#34d399]">
                    <ArrowUpCircle size={10} /> Promovida a Paper
                  </span>
                ) : data.gates.eligibleForPaper ? (
                  <span className="text-[10px] font-mono text-[#475569]">elegible (ya no es draft)</span>
                ) : (
                  <span className="text-[10px] font-mono text-[#f59e0b]">no elegible para Paper</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {data.gates.results.map((g) => (
                  <div key={g.key} className="flex items-center gap-1.5 text-[10px] font-mono">
                    {g.passed
                      ? <CheckCircle2 size={11} className="text-[#34d399] flex-shrink-0" />
                      : <XCircle size={11} className="text-[#ef4444] flex-shrink-0" />}
                    <span className={g.passed ? "text-[#94a3b8]" : "text-[#64748b]"}>{g.label}</span>
                    {g.tier === "should" && <span className="text-[#2d3748] text-[9px]">(opc)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Walk-forward skipped because of insufficient bars. Engine v1
              returns {windows:[],...} when bars < 200*requestedWindows. Make
              that case loud so the user understands WHY there's no WF table
              and can act (shorter range, fewer windows). */}
          {data.walk_forward && data.walk_forward.windows.length === 0 && Number(wfWindows) > 0 && (
            <div className="bg-[#1f1408] border border-[#f59e0b]/40 rounded-lg p-3 flex items-start gap-2" data-testid="walk-forward-insufficient">
              <AlertCircle size={12} className="text-[#f59e0b] mt-0.5 shrink-0" />
              <div className="text-[10px] text-[#f59e0b]">
                Walk-forward requiere ≥{200 * Number(wfWindows)} bars para {wfWindows} ventanas. Subí el rango histórico o reducí el número de ventanas.
              </div>
            </div>
          )}

          {data.advanced && (
            <div className="bg-[#151b28] border border-[#a78bfa]/30 rounded-lg p-3 space-y-2" data-testid="advanced-results">
              <div className="flex items-center gap-2">
                <Brain size={11} className="text-[#a78bfa]" />
                <p className="text-[10px] text-[#a78bfa] uppercase tracking-wider font-medium">Pipeline avanzado</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {data.advanced.ml ? (
                  <div className="bg-[#0a0e1a] border border-[#1f2937] rounded p-2 space-y-1">
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">ML Signal</p>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                      <span className="text-[#475569]">train acc</span>
                      <span className="text-right text-[#34d399]">{formatPct(data.advanced.ml.trainAcc)}</span>
                      <span className="text-[#475569]">valid acc</span>
                      <span className="text-right text-[#22d3ee]">{formatPct(data.advanced.ml.validAcc)}</span>
                    </div>
                    <p className="text-[9px] text-[#475569] truncate" title={data.advanced.ml.featureNames.join(", ")}>
                      features: {data.advanced.ml.featureNames.length}
                    </p>
                  </div>
                ) : null}
                {data.advanced.multiTf ? (
                  <div className="bg-[#0a0e1a] border border-[#1f2937] rounded p-2 space-y-1">
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">Multi-TF</p>
                    <p className="text-[11px] text-[#e2e8f0] font-mono">{data.advanced.multiTf.higherTimeframes.join(" · ")}</p>
                    <p className="text-[9px] text-[#475569]">intent surfaced</p>
                  </div>
                ) : null}
                {data.advanced.portfolio ? (
                  <div className="bg-[#0a0e1a] border border-[#1f2937] rounded p-2 space-y-1">
                    <p className="text-[10px] text-[#475569] uppercase tracking-wider">Portfolio</p>
                    {data.advanced.portfolio.status === "completed" ? (
                      <>
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                          <span className="text-[#475569]">legs</span>
                          <span className="text-right text-[#e2e8f0]">{data.advanced.portfolio.legCount}</span>
                          <span className="text-[#475569]">sharpe</span>
                          <span className="text-right text-[#22d3ee]">{formatNum(data.advanced.portfolio.metrics.sharpe)}</span>
                          <span className="text-[#475569]">return</span>
                          <span className={`text-right ${data.advanced.portfolio.metrics.totalReturnPct >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                            {formatNum(data.advanced.portfolio.metrics.totalReturnPct)}%
                          </span>
                          <span className="text-[#475569]">max DD</span>
                          <span className="text-right text-[#ef4444]">{formatNum(data.advanced.portfolio.metrics.maxDrawdownPct)}%</span>
                        </div>
                      </>
                    ) : data.advanced.portfolio.status === "failed" ? (
                      <>
                        <p className="text-[10px] text-[#ef4444] font-mono">failed</p>
                        <p className="text-[9px] text-[#475569]">{data.advanced.portfolio.reason}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-[#fbbf24] font-mono">pending — usar /backtest/jobs</p>
                        <p className="text-[9px] text-[#475569]">{data.advanced.portfolio.reason}</p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              {Array.isArray(data.advanced_warnings) && data.advanced_warnings.length > 0 ? (
                <div className="flex items-start gap-1.5 pt-1 border-t border-[#1f2937]">
                  <AlertCircle size={11} className="text-[#fbbf24] mt-0.5" />
                  <div className="text-[10px] text-[#fbbf24] font-mono space-y-0.5">
                    {data.advanced_warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                </div>
              ) : null}
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

// ── Side-by-side run comparison ──────────────────────────────────────────────

const COMPARE_METRICS: { key: keyof BacktestMetrics; label: string; kind: "pct" | "num" | "money" }[] = [
  { key: "totalTrades",    label: "Total Trades",   kind: "num"   },
  { key: "winRate",        label: "Win Rate",       kind: "pct"   },
  { key: "totalPnl",       label: "Total PnL",      kind: "money" },
  { key: "sharpe",         label: "Sharpe",         kind: "num"   },
  { key: "sortino",        label: "Sortino",        kind: "num"   },
  { key: "profitFactor",   label: "Profit Factor",  kind: "num"   },
  { key: "maxDrawdownPct", label: "Max DD %",       kind: "pct"   },
  { key: "expectancy",     label: "Expectancy",     kind: "money" },
];

function fmt(v: number | undefined, kind: "pct" | "num" | "money"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (kind === "pct")   return `${(v * 100).toFixed(2)}%`;
  if (kind === "money") return `$${v.toFixed(2)}`;
  return v.toFixed(2);
}

// Compare view — generic for N runs (2 or 3). Mejora #5 extended this from
// hardcoded 2-column layout to dynamic N columns with a single overlapped
// equity chart. Colors and labels follow stable A/B/C positions so the
// winner highlight (◄) and the chart legend stay in sync.
const COMPARE_COLORS = ["#a78bfa", "#22d3ee", "#fbbf24"] as const;  // purple, cyan, yellow
const COMPARE_LABELS = ["A", "B", "C"] as const;

function CompareView({ runs, algorithmId }: { runs: HistoryRow[]; algorithmId: string }) {
  const series = runs
    .map((r, i) => ({
      points: (r.equity_curve ?? []).map((p) => ({ date: p.ts.slice(0, 10), equity: p.equity })),
      color: COMPARE_COLORS[i],
      label: `${COMPARE_LABELS[i]} · ${r.symbol}`,
    }))
    .filter((s) => s.points.length > 1);

  const labelsTitle = runs.map((_, i) => COMPARE_LABELS[i]).join(" vs ");

  return (
    <div className="bg-[#151b28] border border-[#a78bfa]/30 rounded-lg p-3 space-y-3">
      <p className="text-[10px] text-[#a78bfa] uppercase tracking-wider font-medium">Comparación {labelsTitle}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="text-[#475569]">
            <tr>
              <th className="text-left py-1 px-2">Métrica</th>
              {runs.map((r, i) => (
                <th key={r.id} className="text-right py-1 px-2" style={{ color: COMPARE_COLORS[i] }}>
                  {COMPARE_LABELS[i]} · {new Date(r.created_at).toLocaleDateString()} · {r.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_METRICS.map((m) => {
              const vals = runs.map((r) => r.baseline_metrics[m.key] as number | undefined);
              const numeric = vals
                .map((v, i) => ({ v, i }))
                .filter((x): x is { v: number; i: number } => x.v != null && Number.isFinite(x.v));
              let winnerIdx = -1;
              if (numeric.length >= 2) {
                const lowerBetter = LOWER_IS_BETTER.has(m.key as string);
                const sorted = [...numeric].sort((a, b) => lowerBetter ? a.v - b.v : b.v - a.v);
                // Only highlight a winner when there's a strict best (no tie at the top).
                if (sorted[0].v !== sorted[1].v) winnerIdx = sorted[0].i;
              }
              return (
                <tr key={m.key as string} className="border-t border-[#1f2937]">
                  <td className="py-1 px-2 text-[#94a3b8]">{m.label}</td>
                  {vals.map((v, i) => {
                    const isWinner = i === winnerIdx;
                    return (
                      <td key={i} className={`py-1 px-2 text-right ${isWinner ? "text-[#34d399] font-bold" : "text-[#e2e8f0]"}`}>
                        {fmt(v, m.kind)}{isWinner ? " ◄" : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {series.length > 0 && (
        <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-2">
          <p className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">Equity curves (overlap)</p>
          <EquityCurve series={series} height={140} algoId={`${algorithmId}-cmp`} />
        </div>
      )}
    </div>
  );
}

// ── Auto-tune results panel (Mejora #6) ────────────────────────────────────
//
// Embedded section (not a portal modal) that renders the grid sweep state:
// progress bar while streaming, top 5 by Sharpe sorted desc when done, plus
// the "Aplicar y guardar" action that persists the best combo into
// algorithms.parameters.

function AutoTuneResults({
  isStreaming,
  isDone,
  trials,
  best,
  progress,
  error,
  savingTune,
  onApply,
  onClose,
}: {
  isStreaming: boolean;
  isDone: boolean;
  trials: AutoTuneTrial[];
  best: AutoTuneTrial | null;
  progress: { current: number; total: number } | null;
  error: string | null;
  savingTune: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const top5 = [...trials]
    .sort((a, b) => b.sharpe - a.sharpe || b.totalPnl - a.totalPnl)
    .slice(0, 5);

  return (
    <div className="bg-[#151b28] border border-[#fbbf24]/30 rounded-lg p-3 space-y-3" data-testid="auto-tune-results">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#fbbf24] uppercase tracking-wider font-medium flex items-center gap-1.5">
          <Wand2 size={11} /> Auto-tune SL/TP {progress && `· ${progress.current}/${progress.total}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-[#475569] hover:text-[#e2e8f0] transition-colors"
        >
          Cerrar
        </button>
      </div>

      {error && (
        <div className="text-[10px] text-[#ef4444] font-mono">{error}</div>
      )}

      {isStreaming && progress && (
        <div className="space-y-1">
          <div className="h-1 bg-[#0a0e1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#fbbf24] transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#475569] font-mono">
            Probando {progress.current}/{progress.total} combos · best Sharpe hasta ahora: {best?.sharpe.toFixed(2) ?? "—"}
          </p>
        </div>
      )}

      {trials.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="text-[#475569]">
              <tr>
                <th className="text-left py-1 px-2">#</th>
                <th className="text-right py-1 px-2">SL × ATR</th>
                <th className="text-right py-1 px-2">TP × ATR</th>
                <th className="text-right py-1 px-2">Sharpe</th>
                <th className="text-right py-1 px-2">PnL</th>
                <th className="text-right py-1 px-2">Win Rate</th>
                <th className="text-right py-1 px-2">Max DD</th>
                <th className="text-right py-1 px-2">Trades</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((t, i) => {
                const isWinner = i === 0 && isDone;
                return (
                  <tr key={`${t.slAtrMult}-${t.tpAtrMult}`} className="border-t border-[#1f2937]">
                    <td className="py-1 px-2 text-[#94a3b8]">{isWinner ? <Trophy size={10} className="inline text-[#fbbf24]" /> : i + 1}</td>
                    <td className="py-1 px-2 text-right">{t.slAtrMult.toFixed(1)}</td>
                    <td className="py-1 px-2 text-right">{t.tpAtrMult.toFixed(1)}</td>
                    <td className={`py-1 px-2 text-right ${isWinner ? "text-[#34d399] font-bold" : "text-[#22d3ee]"}`}>{t.sharpe.toFixed(2)}</td>
                    <td className={`py-1 px-2 text-right ${t.totalPnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>${t.totalPnl.toFixed(0)}</td>
                    <td className="py-1 px-2 text-right">{(t.winRate * 100).toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right text-[#ef4444]">{(t.maxDrawdownPct * 100).toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right text-[#475569]">{t.trades}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isDone && best && (
        <div className="flex items-center justify-between bg-[#0a0e1a] border border-[#34d399]/30 rounded p-2">
          <div className="text-[10px] text-[#34d399]">
            <span className="font-bold">Best:</span> SL={best.slAtrMult.toFixed(1)} · TP={best.tpAtrMult.toFixed(1)} · Sharpe {best.sharpe.toFixed(2)} · PnL ${best.totalPnl.toFixed(0)}
          </div>
          <button
            type="button"
            onClick={onApply}
            disabled={savingTune}
            className="px-3 py-1.5 rounded-lg bg-[#34d399] hover:bg-[#22b67c] text-[#0a0e1a] text-[10px] font-bold transition-all disabled:opacity-40"
            data-testid="auto-tune-apply"
          >
            {savingTune ? "Guardando…" : "Aplicar y guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
