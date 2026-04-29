'use client';

import { useState } from 'react';
import { Loader2, Play, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import type { AlgorithmRules } from '@/types/backtest';

type Axis = 'slPoints' | 'tpPoints' | 'sizingValue';

interface Cell {
  x: number;
  y: number | null;
  totalPnl: number;
  sharpe: number;
  winRate: number;
  totalTrades: number;
  maxDrawdownPct: number;
}

interface SensitivityResult {
  spec: { xAxis: Axis; xValues: number[]; yAxis?: Axis; yValues?: number[] };
  cells: Cell[];
  bestCell: Cell | null;
  worstCell: Cell | null;
}

interface Props {
  baseConfig: {
    symbol: string;
    timeframe: string;
    from: string;
    to: string;
    initialBalance: number;
    contractSize: number;
    pointValue: number;
    spreadPoints: number;
    commissionPerLot: number;
    slippagePoints: number;
    direction: 'long' | 'short' | 'both';
    parameters: Record<string, unknown>;
    rules: AlgorithmRules;
  };
}

const AXIS_LABELS: Record<Axis, string> = {
  slPoints: 'SL points',
  tpPoints: 'TP points',
  sizingValue: 'Sizing value',
};

function parseList(s: string): number[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
}

export function BacktestSensitivityHeatmap({ baseConfig }: Props) {
  const [xAxis, setXAxis] = useState<Axis>('slPoints');
  const [xValuesStr, setXValuesStr] = useState('100, 200, 300, 400, 500');
  const [enable2D, setEnable2D] = useState(true);
  const [yAxis, setYAxis] = useState<Axis>('tpPoints');
  const [yValuesStr, setYValuesStr] = useState('200, 400, 600, 800, 1000');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SensitivityResult | null>(null);
  const [metric, setMetric] = useState<'totalPnl' | 'sharpe' | 'winRate'>('totalPnl');

  async function run() {
    const xValues = parseList(xValuesStr);
    if (xValues.length === 0) { toast.error('X axis: enter at least one number'); return; }
    let yValues: number[] | undefined;
    if (enable2D) {
      yValues = parseList(yValuesStr);
      if (yValues.length === 0) { toast.error('Y axis: enter at least one number'); return; }
    }
    const cells = xValues.length * (yValues?.length ?? 1);
    if (cells > 36) { toast.error(`Grid too big: ${cells} cells (max 36)`); return; }

    setRunning(true);
    try {
      const r = await fetch('/api/backtest/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: baseConfig,
          spec: enable2D
            ? { xAxis, xValues, yAxis, yValues }
            : { xAxis, xValues },
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? 'Sensitivity failed'); return; }
      setResult(j.result);
      toast.success(`Sweep done · ${j.result.cells.length} cells · ${j.barsUsed} bars`);
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 p-3 rounded bg-[#0f1322] border border-[#1f2937]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-[#475569] font-medium flex items-center gap-1.5">
          <Grid3x3 size={12} /> Sensitivity / parameter sweep
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block">
            <div className="text-[10px] text-[#475569] uppercase mb-1">X axis</div>
            <select value={xAxis} onChange={(e) => setXAxis(e.target.value as Axis)} className={inp}>
              {(['slPoints', 'tpPoints', 'sizingValue'] as Axis[]).map((a) => (
                <option key={a} value={a}>{AXIS_LABELS[a]}</option>
              ))}
            </select>
          </label>
          <input
            value={xValuesStr}
            onChange={(e) => setXValuesStr(e.target.value)}
            placeholder="100, 200, 300"
            className={inp + ' mt-1'}
          />
        </div>

        <div>
          <label className="flex items-center gap-1 text-[10px] text-[#94a3b8] mb-1">
            <input type="checkbox" checked={enable2D} onChange={(e) => setEnable2D(e.target.checked)} />
            Add Y axis (2D heatmap)
          </label>
          {enable2D && (
            <>
              <select value={yAxis} onChange={(e) => setYAxis(e.target.value as Axis)} className={inp}>
                {(['slPoints', 'tpPoints', 'sizingValue'] as Axis[]).map((a) => (
                  <option key={a} value={a}>{AXIS_LABELS[a]}</option>
                ))}
              </select>
              <input
                value={yValuesStr}
                onChange={(e) => setYValuesStr(e.target.value)}
                placeholder="200, 400, 600"
                className={inp + ' mt-1'}
              />
            </>
          )}
        </div>
      </div>

      <button
        onClick={run}
        disabled={running}
        className="w-full py-1.5 rounded text-xs font-semibold bg-[#06b6d4] text-black hover:bg-[#22d3ee] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
        Run sweep
      </button>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex gap-1">
              {(['totalPnl', 'sharpe', 'winRate'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-2 py-0.5 rounded border ${metric === m ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-[#1f2937] text-[#94a3b8]'}`}
                >{m}</button>
              ))}
            </div>
            {result.bestCell && (
              <span className="text-[#34d399]">
                Best: {AXIS_LABELS[result.spec.xAxis]}={result.bestCell.x}
                {result.spec.yAxis && result.bestCell.y !== null && ` · ${AXIS_LABELS[result.spec.yAxis]}=${result.bestCell.y}`}
                {' '}→ ${result.bestCell.totalPnl.toFixed(0)}
              </span>
            )}
          </div>
          <Heatmap result={result} metric={metric} />
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-[11px] px-2 py-1 focus:outline-none focus:border-[#475569]";

function Heatmap({ result, metric }: { result: SensitivityResult; metric: 'totalPnl' | 'sharpe' | 'winRate' }) {
  const { spec, cells } = result;
  const xs = spec.xValues;
  const ys = spec.yValues ?? [null];
  const values = cells.map((c) => c[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const colorFor = (v: number) => {
    if (max === min) return '#06b6d4';
    const t = (v - min) / (max - min);
    if (metric === 'totalPnl' || metric === 'sharpe') {
      const r = Math.round(239 * (1 - t) + 52 * t);
      const g = Math.round(68 * (1 - t) + 211 * t);
      const b = Math.round(68 * (1 - t) + 153 * t);
      return `rgb(${r},${g},${b})`;
    }
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * t);
    return `rgb(${r},${g},100)`;
  };

  const formatVal = (v: number) => {
    if (metric === 'winRate') return `${(v * 100).toFixed(0)}%`;
    if (metric === 'sharpe') return v.toFixed(2);
    return `$${Math.round(v)}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-[#475569]"></th>
            {xs.map((x) => (
              <th key={x} className="px-2 py-1 text-[#94a3b8] font-mono">{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y, yi) => (
            <tr key={yi}>
              <td className="px-2 py-1 text-[#94a3b8] font-mono whitespace-nowrap">
                {y !== null ? y : ''}
              </td>
              {xs.map((x) => {
                const cell = cells.find((c) => c.x === x && c.y === y);
                if (!cell) return <td key={x} />;
                const v = cell[metric];
                return (
                  <td
                    key={x}
                    className="px-2 py-1 text-center font-mono font-bold border border-[#0a0e1a]"
                    style={{
                      backgroundColor: colorFor(v),
                      color: '#0a0e1a',
                      minWidth: 60,
                    }}
                    title={`SL=${cell.x} TP=${cell.y ?? '-'} · pnl=${cell.totalPnl.toFixed(0)} · sharpe=${cell.sharpe.toFixed(2)} · winRate=${(cell.winRate * 100).toFixed(0)}% · trades=${cell.totalTrades}`}
                  >
                    {formatVal(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
