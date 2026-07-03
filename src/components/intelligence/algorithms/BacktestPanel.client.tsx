'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Play, BarChart3, Loader2, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useBacktestJobProgress } from '@/hooks/useBacktestJobProgress';
import type { AlgorithmRules, SimulatedTrade } from '@/types/backtest';
import { BacktestRuleBuilder } from './BacktestRuleBuilder.client';
import { BacktestEquityChart } from './BacktestEquityChart.client';
import { BacktestTradesTable } from './BacktestTradesTable.client';
import { BacktestSensitivityHeatmap } from './BacktestSensitivityHeatmap.client';

interface BacktestPanelProps {
  algorithmId: string;
  defaultSymbol?: string;
  defaultParameters?: Record<string, unknown>;
  // Research-mode hints: when the algorithm has no cuenta vinculada
  // (linkedBotAccountId === null), the Initial Balance input prefills with
  // defaultBacktestBalance instead of the hardcoded $10K. Both safe to omit.
  linkedBotAccountId?: string | null;
  defaultBacktestBalance?: number | null;
}

interface JobRow {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_pct: number;
  current_phase: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface ConePoint { step: number; p5: number; p50: number; p95: number }
interface EquityPoint { ts: string; equity: number; drawdown: number }

interface AdvancedPayload {
  ml:        { used: true; trainAcc: number; validAcc: number; featureNames: string[] } | null;
  multiTf:
    | { used: true; status: 'pending';   higherTimeframes: string[] }
    | { used: true; status: 'completed'; higherTimeframes: string[]; tradesFilteredCount: number; alignment: { byTf: Record<string, { bull: number; bear: number; neutral: number }>; totalPrimaryBars: number } }
    | { used: true; status: 'failed';    higherTimeframes: string[]; reason: string }
    | null;
  portfolio:
    | { used: true; status: 'pending';   reason: string }
    | { used: true; status: 'completed'; legCount: number; metrics: { totalPnl: number; totalReturnPct: number; sharpe: number; maxDrawdown: number; maxDrawdownPct: number; legCorrelations: { a: string; b: string; rho: number }[] }; equityPreviewLast50: { ts: string; equity: number; drawdown: number }[] }
    | { used: true; status: 'failed';    reason: string }
    | null;
}

interface JobResults {
  metrics: Record<string, number>;
  equity_curve: EquityPoint[];
  trades: SimulatedTrade[];
  monte_carlo: {
    iterations: number;
    probProfitable: number;
    probRuin: number;
    finalEquityPercentiles: { p5: number; p50: number; p95: number };
    maxDrawdownPercentiles: { p5: number; p50: number; p95: number };
    cone: ConePoint[];
  } | null;
  walk_forward: {
    avgEfficiency: number;
    isOverfit: boolean;
    oosTotalPnl: number;
  } | null;
  stress_tests: {
    resilient: boolean;
    worstScenario: string;
    scenarios: { name: string; description: string; pnlVsBaseline: number }[];
  } | null;
  advanced: AdvancedPayload | null;
}

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const;
type Tab = 'overview' | 'chart' | 'trades' | 'sensitivity' | 'advanced';

interface PortfolioLegDraft { configId: string; symbol: string; weight: number }

const STATUS_COLORS: Record<JobRow['status'], string> = {
  queued: 'text-[#94a3b8]',
  running: 'text-[#06b6d4]',
  completed: 'text-[#34d399]',
  failed: 'text-[#ef4444]',
  cancelled: 'text-[#94a3b8]',
};

export function BacktestPanel({
  algorithmId,
  defaultSymbol = 'XAUUSD',
  defaultParameters,
  linkedBotAccountId = null,
  defaultBacktestBalance = null,
}: BacktestPanelProps) {
  // Prefill Initial Balance with the persisted default when the algorithm is
  // in research mode (no cuenta vinculada). Falls back to $10K otherwise.
  const initialBalanceDefault = (linkedBotAccountId === null
    && defaultBacktestBalance != null
    && defaultBacktestBalance > 0)
    ? defaultBacktestBalance
    : 10000;
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<JobResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [showRules, setShowRules] = useState(false);

  // Form state
  const today = new Date();
  const oneYearAgo = new Date(today.getTime() - 365 * 24 * 3600 * 1000);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState<typeof TIMEFRAMES[number]>('H1');
  const [from, setFrom] = useState(oneYearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [initialBalance, setInitialBalance] = useState(initialBalanceDefault);
  const [mcIterations, setMcIterations] = useState(1000);
  // Walk-forward default unificado en 4 ventanas con el sync panel. 0 desactiva.
  const [wfWindows, setWfWindows] = useState(4);
  const [stress, setStress] = useState(true);
  const [useMl, setUseMl] = useState(false);
  const [useMultiTf, setUseMultiTf] = useState(false);
  const [usePortfolio, setUsePortfolio] = useState(false);
  const [portfolioLegs, setPortfolioLegs] = useState<PortfolioLegDraft[]>([
    { configId: 'leg-a', symbol: 'EURUSD', weight: 0.5 },
    { configId: 'leg-b', symbol: 'XAUUSD', weight: 0.5 },
  ]);
  const [rules, setRules] = useState<AlgorithmRules>(() => buildDefaultRules(defaultParameters));

  const loadJobs = useCallback(async () => {
    const r = await fetch(`/api/backtest/jobs?algorithm_id=${algorithmId}&limit=10`);
    if (!r.ok) return;
    const j = await r.json();
    setJobs(j.jobs ?? []);
  }, [algorithmId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'queued' || j.status === 'running');
    if (!hasActive) return;
    // Polling kept as fallback when Supabase Realtime is unavailable (eg.
    // browser blocks WebSockets). Once an UPDATE event arrives via the
    // Realtime subscription below, loadJobs() also fires through the
    // status-change effect so the table stays in sync.
    const t = setInterval(loadJobs, 3000);
    return () => clearInterval(t);
  }, [jobs, loadJobs]);

  // Realtime subscription to the most recent active job. When run-job.ts
  // bumps current_phase / progress_pct on the row, this hook receives the
  // UPDATE event in <100ms (vs ~3s for the polling above), so the user sees
  // the phase progress live.
  const activeJobId = useMemo(() => {
    return jobs.find((j) => j.status === 'queued' || j.status === 'running')?.id ?? null;
  }, [jobs]);
  const liveJob = useBacktestJobProgress(activeJobId);

  // Refresh the jobs list immediately when the live job flips to a terminal
  // state so the table picks up the final row + results without waiting for
  // the next 3s poll.
  const liveJobStatus = liveJob.job?.status;
  useEffect(() => {
    if (liveJobStatus === 'completed' || liveJobStatus === 'failed' || liveJobStatus === 'cancelled') {
      void loadJobs();
    }
  }, [liveJobStatus, loadJobs]);

  const loadResults = useCallback(async (jobId: string) => {
    setLoadingResults(true);
    try {
      const r = await fetch(`/api/backtest/jobs/${jobId}`);
      const j = await r.json();
      setSelectedResults(j.results ?? null);
      setSelectedJob(jobId);
      setTab('overview');
    } finally {
      setLoadingResults(false);
    }
  }, []);

  async function handleRun() {
    if (usePortfolio) {
      if (portfolioLegs.length < 2) {
        toast.error('Portfolio necesita al menos 2 legs');
        return;
      }
      if (portfolioLegs.some((l) => !l.configId.trim() || !l.symbol.trim() || l.weight <= 0)) {
        toast.error('Cada leg necesita configId, symbol y weight > 0');
        return;
      }
    }
    setSubmitting(true);
    try {
      const config = {
        algorithmId,
        symbol,
        timeframe,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        initialBalance,
        contractSize: symbol.includes('XAU') ? 100 : 100000,
        pointValue: symbol.includes('XAU') ? 1 : 10,
        spreadPoints: 5,
        commissionPerLot: 7,
        slippagePoints: 2,
        direction: 'both' as const,
        parameters: defaultParameters ?? {},
        rules,
        monteCarloIterations: mcIterations,
        walkForwardWindows: wfWindows,
        stressTests: stress,
        useMl,
        useMultiTf,
        usePortfolio,
        ...(usePortfolio ? { portfolioLegs } : {}),
      };

      const r = await fetch('/api/backtest/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to enqueue backtest');
        return;
      }

      toast.success('Backtest queued');
      setShowForm(false);
      loadJobs();
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#475569] uppercase tracking-wider font-medium flex items-center gap-2">
          <BarChart3 size={12} /> Backtest & Validation
          <span
            title="Motor async job-based: corre en background (backtest_jobs), soporta ML/Multi-TF/Portfolio (multi-símbolo). Tarda más pero es más completo."
            className="normal-case tracking-normal font-normal text-[9px] px-1.5 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/30"
          >
            Async · Completo
          </span>
        </p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 transition-colors"
        >
          <Play size={11} /> {showForm ? 'Cerrar' : 'Nuevo backtest'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 rounded bg-[#0f1322] border border-[#1f2937]">
            <Field label="Symbol">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className={inp} />
            </Field>
            <Field label="Timeframe">
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as typeof TIMEFRAMES[number])} className={inp}>
                {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="From">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} />
            </Field>
            <Field label="Initial Balance">
              <input type="number" min={100} value={initialBalance} onChange={(e) => setInitialBalance(Number(e.target.value))} className={inp} />
            </Field>
            <Field label="MC Iterations">
              <input type="number" min={0} max={10000} step={100} value={mcIterations} onChange={(e) => setMcIterations(Number(e.target.value))} className={inp} />
            </Field>
            <Field label="WF Windows">
              <input type="number" min={0} max={20} value={wfWindows} onChange={(e) => setWfWindows(Number(e.target.value))} className={inp} />
            </Field>
            <Field label="Stress tests">
              <label className="flex items-center gap-1.5 text-xs text-[#e2e8f0] mt-1.5">
                <input type="checkbox" checked={stress} onChange={(e) => setStress(e.target.checked)} />
                <span>Enabled</span>
              </label>
            </Field>
          </div>

          <button
            onClick={() => setShowRules((s) => !s)}
            className="flex items-center gap-1 text-[11px] text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
          >
            {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Reglas {showRules ? '(ocultar)' : '(personalizar)'}
          </button>
          {showRules && <BacktestRuleBuilder rules={rules} onChange={setRules} />}

          <div className="p-3 rounded bg-[#0f1322] border border-[#1f2937] space-y-2" data-testid="advanced-pipeline-section">
            <p className="text-[10px] text-[#475569] uppercase tracking-wide font-medium">Pipeline avanzado (opt-in)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-start gap-2 cursor-pointer" title="Logreg sobre features técnicas (RSI/ATR/EMA spread).">
                <input type="checkbox" checked={useMl} onChange={(e) => setUseMl(e.target.checked)} className="mt-0.5 accent-[#06b6d4]" data-testid="jobs-toggle-use-ml" />
                <span className="text-[11px] text-[#cbd5e1]">
                  <span className="font-medium">ML signal</span>
                  <span className="block text-[10px] text-[#475569]">train/valid acc</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer" title="Surface higher TF intent — default H4 + D1.">
                <input type="checkbox" checked={useMultiTf} onChange={(e) => setUseMultiTf(e.target.checked)} className="mt-0.5 accent-[#06b6d4]" data-testid="jobs-toggle-use-multi-tf" />
                <span className="text-[11px] text-[#cbd5e1]">
                  <span className="font-medium">Multi-TF</span>
                  <span className="block text-[10px] text-[#475569]">higher timeframes</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer" title="Multi-símbolo. Cada leg corre la misma estrategia sobre su symbol.">
                <input type="checkbox" checked={usePortfolio} onChange={(e) => setUsePortfolio(e.target.checked)} className="mt-0.5 accent-[#06b6d4]" data-testid="jobs-toggle-use-portfolio" />
                <span className="text-[11px] text-[#cbd5e1]">
                  <span className="font-medium">Portfolio</span>
                  <span className="block text-[10px] text-[#475569]">multi-símbolo</span>
                </span>
              </label>
            </div>

            {usePortfolio && (
              <div className="border-t border-[#1f2937] pt-2 space-y-1.5" data-testid="portfolio-legs-editor">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#475569] uppercase tracking-wide font-medium">Legs (mínimo 2)</p>
                  <button
                    type="button"
                    onClick={() => setPortfolioLegs((legs) => [...legs, { configId: `leg-${legs.length + 1}`, symbol: 'EURUSD', weight: 0.25 }])}
                    disabled={portfolioLegs.length >= 10}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 disabled:opacity-40"
                    data-testid="portfolio-add-leg"
                  >
                    + leg
                  </button>
                </div>
                {portfolioLegs.map((leg, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      value={leg.configId}
                      onChange={(e) => setPortfolioLegs((legs) => legs.map((l, i) => i === idx ? { ...l, configId: e.target.value } : l))}
                      className={`${inp} col-span-4`}
                      placeholder="leg id"
                    />
                    <input
                      value={leg.symbol}
                      onChange={(e) => setPortfolioLegs((legs) => legs.map((l, i) => i === idx ? { ...l, symbol: e.target.value.toUpperCase() } : l))}
                      className={`${inp} col-span-4`}
                      placeholder="SYMBOL"
                    />
                    <input
                      type="number"
                      step={0.05}
                      min={0.05}
                      max={1}
                      value={leg.weight}
                      onChange={(e) => setPortfolioLegs((legs) => legs.map((l, i) => i === idx ? { ...l, weight: Number(e.target.value) } : l))}
                      className={`${inp} col-span-3`}
                      placeholder="weight"
                    />
                    <button
                      type="button"
                      onClick={() => setPortfolioLegs((legs) => legs.filter((_, i) => i !== idx))}
                      disabled={portfolioLegs.length <= 2}
                      className="col-span-1 text-[#ef4444] hover:text-[#fca5a5] disabled:opacity-30 text-xs"
                      aria-label="remove leg"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <p className="text-[9px] text-[#475569]">Los weights se normalizan internamente al total. Capital inicial × weight por leg.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleRun}
              disabled={submitting}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-[#06b6d4] text-black hover:bg-[#22d3ee] disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {submitting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Run
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {jobs.length === 0 && (
          <p className="text-xs text-[#475569] text-center py-3">No backtests yet — run your first robust validation.</p>
        )}
        {jobs.map((j) => {
          // Merge in the Realtime snapshot for the active job so the phase
          // label + progress % update in <100ms instead of waiting for the
          // 3s poll. Non-active jobs render from `j` as before.
          const liveOverride = liveJob.job && liveJob.job.id === j.id ? liveJob.job : null;
          const phase = liveOverride?.current_phase ?? j.current_phase;
          const pct = liveOverride?.progress_pct ?? j.progress_pct;
          const status = liveOverride?.status ?? j.status;
          return (
          <button
            key={j.id}
            onClick={() => status === 'completed' && loadResults(j.id)}
            disabled={status !== 'completed'}
            className={`w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs transition-colors ${
              selectedJob === j.id ? 'border-[#06b6d4] bg-[#06b6d4]/5' : 'border-[#1f2937] hover:border-[#475569]'
            } ${status === 'completed' ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={status} />
              <div className="min-w-0">
                <div className={`font-mono ${STATUS_COLORS[status]}`}>
                  {status} {phase && status === 'running' ? `· ${phase}` : ''}
                </div>
                <div className="text-[10px] text-[#475569]">{new Date(j.created_at).toLocaleString()}</div>
                {/* Inline progress bar — only visible while running. Drives
                    off the live override when available, fallback to the
                    polled row otherwise. */}
                {status === 'running' && (
                  <div className="mt-1 h-0.5 w-32 rounded-full bg-[#1f2937] overflow-hidden">
                    <div
                      className="h-full bg-[#06b6d4] transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      aria-label={`Progress ${Math.round(pct)}%`}
                    />
                  </div>
                )}
              </div>
            </div>
            {status === 'running' && (
              <div className="text-[10px] text-[#06b6d4] font-mono">{Math.round(pct)}%</div>
            )}
            {status === 'failed' && j.error && (
              <div className="text-[10px] text-[#ef4444] truncate max-w-[200px]" title={j.error}>{j.error}</div>
            )}
          </button>
          );
        })}
      </div>

      {selectedJob && (loadingResults ? (
        <div className="text-xs text-[#94a3b8] flex items-center gap-2 py-2">
          <Loader2 size={12} className="animate-spin" /> Loading results…
        </div>
      ) : selectedResults && (
        <div className="space-y-2">
          <div className="flex gap-1 border-b border-[#1f2937] -mb-px">
            <TabBtn active={tab === 'overview'}    onClick={() => setTab('overview')}>Overview</TabBtn>
            <TabBtn active={tab === 'chart'}       onClick={() => setTab('chart')}>Equity</TabBtn>
            <TabBtn active={tab === 'trades'}      onClick={() => setTab('trades')}>Trades ({selectedResults.trades.length})</TabBtn>
            <TabBtn active={tab === 'sensitivity'} onClick={() => setTab('sensitivity')}>Sensitivity</TabBtn>
            {selectedResults.advanced && (
              <TabBtn active={tab === 'advanced'} onClick={() => setTab('advanced')}>
                <span data-testid="advanced-tab-label">Advanced</span>
              </TabBtn>
            )}
          </div>

          {tab === 'overview' && <ResultsOverview results={selectedResults} />}
          {tab === 'chart' && (
            <div className="p-3 rounded bg-[#0f1322] border border-[#1f2937]">
              <BacktestEquityChart
                equity={selectedResults.equity_curve}
                cone={selectedResults.monte_carlo?.cone ?? null}
                initialBalance={selectedResults.metrics.totalPnl !== undefined && selectedResults.equity_curve[0]
                  ? selectedResults.equity_curve[0].equity
                  : 10000}
              />
            </div>
          )}
          {tab === 'trades' && (
            <div className="p-3 rounded bg-[#0f1322] border border-[#1f2937]">
              <BacktestTradesTable trades={selectedResults.trades} />
            </div>
          )}
          {tab === 'sensitivity' && (
            <BacktestSensitivityHeatmap
              baseConfig={{
                symbol,
                timeframe,
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
                initialBalance,
                contractSize: symbol.includes('XAU') ? 100 : 100000,
                pointValue: symbol.includes('XAU') ? 1 : 10,
                spreadPoints: 5,
                commissionPerLot: 7,
                slippagePoints: 2,
                direction: 'both',
                parameters: defaultParameters ?? {},
                rules,
              }}
            />
          )}
          {tab === 'advanced' && selectedResults.advanced && (
            <ResultsAdvanced advanced={selectedResults.advanced} />
          )}
        </div>
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[11px] font-medium border-b-2 transition-colors ${
        active ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-transparent text-[#94a3b8] hover:text-[#e2e8f0]'
      }`}
    >{children}</button>
  );
}

function StatusIcon({ status }: { status: JobRow['status'] }) {
  if (status === 'running' || status === 'queued') return <Loader2 size={12} className="animate-spin text-[#06b6d4]" />;
  if (status === 'completed') return <CheckCircle2 size={12} className="text-[#34d399]" />;
  if (status === 'failed') return <XCircle size={12} className="text-[#ef4444]" />;
  return <AlertCircle size={12} className="text-[#94a3b8]" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] text-[#475569] uppercase tracking-wide font-medium mb-1">{label}</div>
      {children}
    </label>
  );
}

const inp = "w-full rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1 focus:outline-none focus:border-[#475569]";

function ResultsOverview({ results }: { results: JobResults }) {
  const m = results.metrics;
  return (
    <div className="space-y-3 p-3 rounded bg-[#0f1322] border border-[#1f2937]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total trades" value={m.totalTrades?.toString() ?? '0'} />
        <Stat label="Win rate"     value={fmtPct(m.winRate)} />
        <Stat label="Total P&L"    value={fmtUsd(m.totalPnl)} colorize={m.totalPnl} />
        <Stat label="Profit factor" value={(m.profitFactor ?? 0).toFixed(2)} />
        <Stat label="Sharpe"       value={(m.sharpe ?? 0).toFixed(2)} />
        <Stat label="Sortino"      value={(m.sortino ?? 0).toFixed(2)} />
        <Stat label="Max DD"       value={fmtPct(m.maxDrawdownPct)} colorize={-Math.abs(m.maxDrawdownPct ?? 0)} />
        <Stat label="Calmar"       value={(m.calmar ?? 0).toFixed(2)} />
      </div>

      {results.monte_carlo && (
        <div className="border-t border-[#1f2937] pt-2">
          <div className="text-[10px] uppercase tracking-wide text-[#475569] mb-1">Monte Carlo ({results.monte_carlo.iterations} iters)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Prob. profitable" value={fmtPct(results.monte_carlo.probProfitable)} />
            <Stat label="Prob. ruin"       value={fmtPct(results.monte_carlo.probRuin)} colorize={-results.monte_carlo.probRuin} />
            <Stat label="Final p5"  value={fmtUsd(results.monte_carlo.finalEquityPercentiles.p5)} />
            <Stat label="Final p95" value={fmtUsd(results.monte_carlo.finalEquityPercentiles.p95)} />
          </div>
        </div>
      )}

      {results.walk_forward && results.walk_forward.avgEfficiency !== undefined && (
        <div className="border-t border-[#1f2937] pt-2">
          <div className="text-[10px] uppercase tracking-wide text-[#475569] mb-1">Walk-forward</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Stat label="Avg efficiency" value={results.walk_forward.avgEfficiency.toFixed(2)} />
            <Stat label="OOS P&L"        value={fmtUsd(results.walk_forward.oosTotalPnl)} colorize={results.walk_forward.oosTotalPnl} />
            <Stat label="Overfit?" value={results.walk_forward.isOverfit ? 'YES' : 'no'} colorize={results.walk_forward.isOverfit ? -1 : 1} />
          </div>
        </div>
      )}

      {results.stress_tests && (
        <div className="border-t border-[#1f2937] pt-2">
          <div className="text-[10px] uppercase tracking-wide text-[#475569] mb-1">Stress tests</div>
          <div className="text-xs text-[#e2e8f0] mb-1">
            Resilience:&nbsp;
            <span className={results.stress_tests.resilient ? 'text-[#34d399]' : 'text-[#ef4444]'}>
              {results.stress_tests.resilient ? 'Robust' : 'Fragile'}
            </span>
            &nbsp;· Worst:&nbsp;<span className="font-mono text-[#94a3b8]">{results.stress_tests.worstScenario}</span>
          </div>
          <div className="space-y-0.5">
            {results.stress_tests.scenarios.map((s) => (
              <div key={s.name} className="flex justify-between text-[11px]">
                <span className="text-[#94a3b8]">{s.description}</span>
                <span className={`font-mono ${s.pnlVsBaseline >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                  {s.pnlVsBaseline >= 0 ? '+' : ''}${s.pnlVsBaseline.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsAdvanced({ advanced }: { advanced: AdvancedPayload }) {
  return (
    <div className="space-y-3 p-3 rounded bg-[#0f1322] border border-[#1f2937]" data-testid="advanced-results-panel">
      {advanced.ml && (
        <section className="space-y-2" data-testid="advanced-ml-block">
          <h4 className="text-[11px] text-[#a78bfa] uppercase tracking-wider font-medium">ML Signal</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Train acc" value={fmtPct(advanced.ml.trainAcc)} colorize={advanced.ml.trainAcc - 0.5} />
            <Stat label="Valid acc" value={fmtPct(advanced.ml.validAcc)} colorize={advanced.ml.validAcc - 0.5} />
            <Stat label="Features"  value={String(advanced.ml.featureNames.length)} />
            <Stat label="Gap" value={fmtPct(advanced.ml.trainAcc - advanced.ml.validAcc)} colorize={-(advanced.ml.trainAcc - advanced.ml.validAcc)} />
          </div>
          <p className="text-[10px] text-[#475569] font-mono truncate" title={advanced.ml.featureNames.join(', ')}>
            {advanced.ml.featureNames.slice(0, 6).join(' · ')}{advanced.ml.featureNames.length > 6 ? ` · +${advanced.ml.featureNames.length - 6}` : ''}
          </p>
        </section>
      )}

      {advanced.multiTf && (
        <section className="space-y-2" data-testid="advanced-multitf-block">
          <h4 className="text-[11px] text-[#a78bfa] uppercase tracking-wider font-medium">
            Multi-TF
            <span className={`ml-2 text-[9px] uppercase tracking-wide ${
              advanced.multiTf.status === 'completed' ? 'text-[#34d399]'
              : advanced.multiTf.status === 'failed' ? 'text-[#ef4444]'
              : 'text-[#fbbf24]'
            }`}>
              · {advanced.multiTf.status}
            </span>
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {advanced.multiTf.higherTimeframes.map((tf) => (
              <span key={tf} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/30">
                {tf}
              </span>
            ))}
          </div>
          {advanced.multiTf.status === 'completed' && (
            <>
              <p className="text-[10px] text-[#cbd5e1]" data-testid="multitf-filtered-count">
                <span className="font-mono text-[#34d399]">{advanced.multiTf.tradesFilteredCount}</span>
                {' '}entradas bloqueadas por contradicción con TFs superiores.
              </p>
              <div className="space-y-1">
                <p className="text-[9px] text-[#475569] uppercase tracking-wider">Distribución de bias</p>
                {Object.entries(advanced.multiTf.alignment.byTf).map(([tf, dist]) => {
                  const total = dist.bull + dist.bear + dist.neutral || 1;
                  const bullPct = (dist.bull / total) * 100;
                  const bearPct = (dist.bear / total) * 100;
                  const neutralPct = (dist.neutral / total) * 100;
                  return (
                    <div key={tf} className="space-y-0.5">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-[#94a3b8]">{tf}</span>
                        <span className="text-[#475569]">
                          <span className="text-[#34d399]">{bullPct.toFixed(0)}%</span> ·{' '}
                          <span className="text-[#ef4444]">{bearPct.toFixed(0)}%</span> ·{' '}
                          <span className="text-[#94a3b8]">{neutralPct.toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="flex h-1.5 rounded overflow-hidden bg-[#0a0e1a]">
                        <div className="bg-[#34d399]" style={{ width: `${bullPct}%` }} />
                        <div className="bg-[#ef4444]" style={{ width: `${bearPct}%` }} />
                        <div className="bg-[#94a3b8]/40" style={{ width: `${neutralPct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[9px] text-[#475569]">bull · bear · neutral · {advanced.multiTf.alignment.totalPrimaryBars} bars</p>
              </div>
            </>
          )}
          {advanced.multiTf.status === 'failed' && (
            <p className="text-[10px] text-[#ef4444] font-mono">{advanced.multiTf.reason}</p>
          )}
          {advanced.multiTf.status === 'pending' && (
            <p className="text-[10px] text-[#475569]">Pending — el filter solo corre desde el flujo async (run-job).</p>
          )}
        </section>
      )}

      {advanced.portfolio && advanced.portfolio.status === 'completed' && (
        <section className="space-y-2" data-testid="advanced-portfolio-completed">
          <h4 className="text-[11px] text-[#a78bfa] uppercase tracking-wider font-medium">Portfolio · {advanced.portfolio.legCount} legs</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Total P&L" value={fmtUsd(advanced.portfolio.metrics.totalPnl)} colorize={advanced.portfolio.metrics.totalPnl} />
            <Stat label="Return"    value={`${advanced.portfolio.metrics.totalReturnPct.toFixed(2)}%`} colorize={advanced.portfolio.metrics.totalReturnPct} />
            <Stat label="Sharpe"    value={advanced.portfolio.metrics.sharpe.toFixed(3)} colorize={advanced.portfolio.metrics.sharpe} />
            <Stat label="Max DD"    value={`${advanced.portfolio.metrics.maxDrawdownPct.toFixed(2)}%`} colorize={-Math.abs(advanced.portfolio.metrics.maxDrawdownPct)} />
          </div>
          {advanced.portfolio.metrics.legCorrelations.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-[10px] text-[#475569] uppercase tracking-wider mb-1">Correlaciones</p>
              <table className="w-full text-[10px] font-mono">
                <thead className="text-[#475569]">
                  <tr>
                    <th className="text-left py-1 px-2">Leg A</th>
                    <th className="text-left py-1 px-2">Leg B</th>
                    <th className="text-right py-1 px-2">ρ</th>
                  </tr>
                </thead>
                <tbody>
                  {advanced.portfolio.metrics.legCorrelations.map((c, i) => {
                    const absR = Math.abs(c.rho);
                    const color = absR > 0.7 ? 'text-[#ef4444]' : absR > 0.4 ? 'text-[#fbbf24]' : 'text-[#34d399]';
                    return (
                      <tr key={i} className="border-t border-[#1f2937]">
                        <td className="py-1 px-2 text-[#e2e8f0]">{c.a}</td>
                        <td className="py-1 px-2 text-[#e2e8f0]">{c.b}</td>
                        <td className={`py-1 px-2 text-right ${color}`}>{c.rho.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[9px] text-[#475569] mt-1">|ρ|&gt;0.7 alta correlación · entre 0.4–0.7 moderada · &lt;0.4 baja.</p>
            </div>
          )}
        </section>
      )}

      {advanced.portfolio && advanced.portfolio.status === 'failed' && (
        <section className="space-y-1 border border-[#ef4444]/30 bg-[#ef4444]/5 rounded p-2" data-testid="advanced-portfolio-failed">
          <h4 className="text-[11px] text-[#ef4444] uppercase tracking-wider font-medium">Portfolio · failed</h4>
          <p className="text-[10px] text-[#ef4444] font-mono">{advanced.portfolio.reason}</p>
        </section>
      )}

      {advanced.portfolio && advanced.portfolio.status === 'pending' && (
        <section className="space-y-1 border border-[#fbbf24]/30 bg-[#fbbf24]/5 rounded p-2" data-testid="advanced-portfolio-pending">
          <h4 className="text-[11px] text-[#fbbf24] uppercase tracking-wider font-medium">Portfolio · pending</h4>
          <p className="text-[10px] text-[#fbbf24] font-mono">{advanced.portfolio.reason}</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, colorize }: { label: string; value: string; colorize?: number }) {
  const color = colorize === undefined ? 'text-[#e2e8f0]' : colorize > 0 ? 'text-[#34d399]' : colorize < 0 ? 'text-[#ef4444]' : 'text-[#e2e8f0]';
  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded p-1.5">
      <div className="text-[10px] text-[#475569] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

function fmtUsd(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '$0';
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(2)}%`;
}

function buildDefaultRules(params: Record<string, unknown> | undefined): AlgorithmRules {
  const rsiBuy = numParam(params, 'rsiBuyLevel', 30);
  const rsiSell = numParam(params, 'rsiSellLevel', 70);
  const sl = numParam(params, 'stopLossPoints', 200);
  const tp = numParam(params, 'takeProfitPoints', 400);

  return {
    entryLong:  [{ left: { type: 'rsi', period: 14 }, op: '<', right: rsiBuy }],
    entryShort: [{ left: { type: 'rsi', period: 14 }, op: '>', right: rsiSell }],
    exitLong:   [{ left: { type: 'rsi', period: 14 }, op: '>', right: 50 }],
    exitShort:  [{ left: { type: 'rsi', period: 14 }, op: '<', right: 50 }],
    slPoints: sl,
    tpPoints: tp,
    sizing: { mode: 'fixed_lot', value: 0.1 },
    maxConcurrent: 1,
  };
}

function numParam(params: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const v = params?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}
