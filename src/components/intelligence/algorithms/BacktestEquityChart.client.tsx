'use client';

import { useMemo } from 'react';

interface EquityPoint { ts: string; equity: number; drawdown: number }
interface ConePoint { step: number; p5: number; p50: number; p95: number }

interface ChartProps {
  equity: EquityPoint[];
  cone?: ConePoint[] | null;
  initialBalance: number;
  height?: number;
}

const W = 600;
const PAD_L = 50;
const PAD_R = 12;
const PAD_T = 8;
const PAD_B = 22;

export function BacktestEquityChart({ equity, cone, initialBalance, height = 220 }: ChartProps) {
  const { eqPath, ddPath, conePath, p50Path, yMin, yMax, xLabels } = useMemo(() => {
    if (equity.length < 2) {
      return { eqPath: '', ddPath: '', conePath: '', p50Path: '', yMin: 0, yMax: 1, xLabels: [] };
    }
    const eqs = equity.map((e) => e.equity);
    let min = Math.min(...eqs);
    let max = Math.max(...eqs);
    if (cone && cone.length > 1) {
      min = Math.min(min, ...cone.map((c) => c.p5));
      max = Math.max(max, ...cone.map((c) => c.p95));
    }
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;
    const innerW = W - PAD_L - PAD_R;
    const innerH = height - PAD_T - PAD_B;

    const xEq = (i: number) => PAD_L + (i / (equity.length - 1)) * innerW;
    const yVal = (v: number) => PAD_T + ((max - v) / range) * innerH;

    const eqCoords = equity.map((p, i) => `${xEq(i).toFixed(1)},${yVal(p.equity).toFixed(1)}`).join(' L ');
    const eqPath = `M ${eqCoords}`;

    const ddBaseY = PAD_T + innerH;
    const ddCoords = equity.map((p, i) => `${xEq(i).toFixed(1)},${(ddBaseY - p.drawdown * 24).toFixed(1)}`).join(' L ');
    const ddPath = `M ${PAD_L},${ddBaseY} L ${ddCoords} L ${(PAD_L + innerW).toFixed(1)},${ddBaseY} Z`;

    let conePath = '';
    let p50Path = '';
    if (cone && cone.length > 1) {
      const xCone = (i: number) => PAD_L + (i / (cone.length - 1)) * innerW;
      const upper = cone.map((c, i) => `${xCone(i).toFixed(1)},${yVal(c.p95).toFixed(1)}`).join(' L ');
      const lower = [...cone].reverse().map((c, i) => `${xCone(cone.length - 1 - i).toFixed(1)},${yVal(c.p5).toFixed(1)}`).join(' L ');
      conePath = `M ${upper} L ${lower} Z`;
      p50Path = 'M ' + cone.map((c, i) => `${xCone(i).toFixed(1)},${yVal(c.p50).toFixed(1)}`).join(' L ');
    }

    const xLabels: { x: number; label: string }[] = [];
    const labelCount = 5;
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (equity.length - 1));
      xLabels.push({ x: xEq(idx), label: equity[idx].ts.slice(0, 10) });
    }

    return { eqPath, ddPath, conePath, p50Path, yMin: min, yMax: max, xLabels };
  }, [equity, cone, height]);

  if (equity.length < 2) {
    return <div className="text-[10px] text-[#475569] italic py-3">No equity data</div>;
  }

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const innerH = height - PAD_T - PAD_B;
  const yPos = (v: number) => PAD_T + ((yMax - v) / (yMax - yMin || 1)) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#1f2937" strokeWidth="0.5" />
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="#1f2937" strokeWidth="0.5" />

      <line
        x1={PAD_L} y1={yPos(initialBalance)} x2={W - PAD_R} y2={yPos(initialBalance)}
        stroke="#475569" strokeWidth="0.5" strokeDasharray="3,3"
      />

      {conePath && (
        <>
          <path d={conePath} fill="#06b6d4" fillOpacity="0.12" stroke="none" />
          <path d={p50Path} fill="none" stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="2,3" />
        </>
      )}

      <path d={ddPath} fill="#ef4444" fillOpacity="0.18" stroke="none" />
      <path d={eqPath} fill="none" stroke="#34d399" strokeWidth="1.4" />

      {yTicks.map((t, i) => (
        <g key={i}>
          <text x={PAD_L - 4} y={yPos(t) + 3} fontSize="9" fill="#475569" textAnchor="end" fontFamily="monospace">
            ${t >= 1000 ? (t / 1000).toFixed(1) + 'k' : t.toFixed(0)}
          </text>
        </g>
      ))}

      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 6} fontSize="9" fill="#475569" textAnchor="middle" fontFamily="monospace">
          {l.label}
        </text>
      ))}

      <g transform={`translate(${PAD_L + 6}, ${PAD_T + 6})`}>
        <rect width="92" height={cone ? 36 : 22} fill="#0a0e1a" fillOpacity="0.85" rx="2" />
        <circle cx="6" cy="8" r="3" fill="#34d399" />
        <text x="14" y="11" fontSize="9" fill="#e2e8f0">Equity</text>
        {cone && (
          <>
            <rect x="3" y="18" width="6" height="6" fill="#06b6d4" fillOpacity="0.4" />
            <text x="14" y="24" fontSize="9" fill="#e2e8f0">MC p5–p95</text>
          </>
        )}
      </g>
    </svg>
  );
}
