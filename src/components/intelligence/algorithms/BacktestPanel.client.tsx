'use client';

import { useEffect, useState, useCallback } from 'react';
import { Play, BarChart3, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BacktestPanelProps {
  algorithmId: string;
  defaultSymbol?: string;
  defaultParameters?: Record<string, unknown>;
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

interface JobResults {
  metrics: Record<string, number>;
  monte_carlo: {
    iterations: number;
    probProfitable: number;
    probRuin: number;
    finalEquityPercentiles: { p5: number; p50: number; p95: number };
    maxDrawdownPercentiles: { p5: number; p50: number; p95: number };
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
}

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const;

const STATUS_COLORS: Record<JobRow['status'], string> = {
  queued: 'text-[#94a3b8]',
  running: 'text-[#06b6d4]',
  completed: 'text-[#34d399]',
  failed: 'text-[#ef4444]',
  cancelled: 'text-[#94a3b8]',
};

export function BacktestPanel({ algorithmId, defaultSymbol = 'XAUUSD', defaultParameters }: BacktestPanelProps) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<JobResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Form state
  const today = new Date();
  const oneYearAgo = new Date(today.getTime() - 365 * 24 * 3600 * 1000);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState<typeof TIMEFRAMES[number]>('H1');
  const [from, setFrom] = useState(oneYearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [initialBalance, setInitialBalance] = useState(10000);
  const [mcIterations, setMcIterations] = useState(1000);
  const [wfWindows, setWfWindows] = useState(5);
  const [stress, setStress] = useState(true);

  const loadJobs = useCallback(async () => {
    const r = await fetch(`/api/backtest/jobs?algorithm_id=${algorithmId}&limit=10`);
    if (!r.ok) return;
    const j = await r.json();
    setJobs(j.jobs ?? []);
  }, [algorithmId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll while any job is running
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'queued' || j.status === 'running');
    if (!hasActive) return;
    const t = setInterval(loadJobs, 3000);
    return () => clearInterval(t);
  }, [jobs, loadJobs]);

  const loadResults = useCallback(async (jobId: string) => {
    setLoadingResults(true);
    try {
      const r = await fetch(`/api/backtest/jobs/${jobId}`);
      const j = await r.json();
      setSelectedResults(j.results ?? null);
      setSelectedJob(jobId);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  async function handleRun() {
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
        rules: buildDefaultRules(defaultParameters),
        monteCarloIterations: mcIterations,
        walkForwardWindows: wfWindows,
        stressTests: stress,
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
        </p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 transition-colors"
        >
          <Play size={11} /> {showForm ? 'Cerrar' : 'Nuevo backtest'}
        </button>
      </div>

      {showForm && (
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
          <div className="col-span-2 lg:col-span-4 flex justify-end mt-1">
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
        {jobs.map((j) => (
          <button
            key={j.id}
            onClick={() => j.status === 'completed' && loadResults(j.id)}
            disabled={j.status !== 'completed'}
            className={`w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs transition-colors ${
              selectedJob === j.id ? 'border-[#06b6d4] bg-[#06b6d4]/5' : 'border-[#1f2937] hover:border-[#475569]'
            } ${j.status === 'completed' ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={j.status} />
              <div className="min-w-0">
                <div className={`font-mono ${STATUS_COLORS[j.status]}`}>
                  {j.status} {j.current_phase && j.status === 'running' ? `· ${j.current_phase}` : ''}
                </div>
                <div className="text-[10px] text-[#475569]">{new Date(j.created_at).toLocaleString()}</div>
              </div>
            </div>
            {j.status === 'running' && (
              <div className="text-[10px] text-[#06b6d4] font-mono">{Math.round(j.progress_pct)}%</div>
            )}
            {j.status === 'failed' && j.error && (
              <div className="text-[10px] text-[#ef4444] truncate max-w-[200px]" title={j.error}>{j.error}</div>
            )}
          </button>
        ))}
      </div>

      {selectedJob && (loadingResults ? (
        <div className="text-xs text-[#94a3b8] flex items-center gap-2 py-2">
          <Loader2 size={12} className="animate-spin" /> Loading results…
        </div>
      ) : selectedResults && (
        <ResultsView results={selectedResults} />
      ))}
    </div>
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

function ResultsView({ results }: { results: JobResults }) {
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

// Build naive default rules from algorithm parameters until ParameterRules wizard ships.
function buildDefaultRules(params: Record<string, unknown> | undefined) {
  const rsiBuy = numParam(params, 'rsiBuyLevel', 30);
  const rsiSell = numParam(params, 'rsiSellLevel', 70);
  const sl = numParam(params, 'stopLossPoints', 200);
  const tp = numParam(params, 'takeProfitPoints', 400);

  return {
    entryLong:  [{ left: { type: 'rsi' as const, period: 14 }, op: '<' as const, right: rsiBuy }],
    entryShort: [{ left: { type: 'rsi' as const, period: 14 }, op: '>' as const, right: rsiSell }],
    exitLong:   [{ left: { type: 'rsi' as const, period: 14 }, op: '>' as const, right: 50 }],
    exitShort:  [{ left: { type: 'rsi' as const, period: 14 }, op: '<' as const, right: 50 }],
    slPoints: sl,
    tpPoints: tp,
    sizing: { mode: 'fixed_lot' as const, value: 0.1 },
    maxConcurrent: 1,
  };
}

function numParam(params: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const v = params?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}
