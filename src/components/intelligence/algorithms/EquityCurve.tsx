'use client';

import { useMemo } from 'react';

interface EquityPoint {
  date: string;
  equity: number;
}

/**
 * Multi-series overlay. Each series gets its own stroked path on the same
 * viewBox so the user can compare the shape of 2-3 equity curves on a single
 * chart. Used by the CompareView when 2 or 3 runs are selected from history.
 *
 * `label` is rendered as an inline legend chip; `color` is the stroke color
 * (no gradient fill in multi-series mode — fills would overlap and become
 * unreadable).
 */
export interface EquitySeries {
  points: EquityPoint[];
  color: string;
  label: string;
}

interface EquityCurveProps {
  /** Single-series API. Backwards compatible with all existing call sites. */
  points?: EquityPoint[];
  /** Multi-series API. When provided, overrides `points` and renders one stroked path per series. */
  series?: EquitySeries[];
  height?: number;
  algoId?: string;
}

function generateDemoPoints(): EquityPoint[] {
  const points: EquityPoint[] = [];
  let equity = 10000;
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    equity += (Math.random() - 0.38) * 400;
    points.push({ date: date.toISOString().split('T')[0], equity: Math.max(equity, 8000) });
  }
  return points;
}

const DEMO_POINTS = generateDemoPoints();

function buildLinePath(points: EquityPoint[], minEquity: number, maxEquity: number, height: number): string {
  if (points.length < 2) return '';
  const w = 100;
  const pad = 4;
  const range = maxEquity - minEquity || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + ((maxEquity - p.equity) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  return `M ${coords.join(' L ')}`;
}

export function EquityCurve({ points, series, height = 120, algoId = 'default' }: EquityCurveProps) {
  // Multi-series path (Mejora #5: compare 2-3 runs overlapped on one chart)
  const multi = useMemo(() => {
    if (!series || series.length === 0) return null;
    const allEquities = series.flatMap((s) => s.points.map((p) => p.equity));
    if (allEquities.length === 0) return null;
    const min = Math.min(...allEquities);
    const max = Math.max(...allEquities);
    return {
      min,
      max,
      paths: series.map((s) => ({
        d: buildLinePath(s.points, min, max, height),
        color: s.color,
        label: s.label,
      })),
    };
  }, [series, height]);

  // Single-series fallback (backwards-compatible original behavior)
  const single = useMemo(() => {
    if (multi) return null;
    const effectivePoints = points ?? DEMO_POINTS;
    if (effectivePoints.length < 2) return { path: '', minEquity: 0, maxEquity: 0, isPositive: true };

    const equities = effectivePoints.map((p) => p.equity);
    const min = Math.min(...equities);
    const max = Math.max(...equities);
    const range = max - min || 1;

    const w = 100;
    const h = height;
    const pad = 4;

    const coords = effectivePoints.map((p, i) => {
      const x = pad + (i / (effectivePoints.length - 1)) * (w - pad * 2);
      const y = pad + ((max - p.equity) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const line = `M ${coords.join(' L ')}`;
    const area = `${line} L ${100 - pad},${h - pad} L ${pad},${h - pad} Z`;

    const start = effectivePoints[0].equity;
    const end = effectivePoints[effectivePoints.length - 1].equity;

    return { path: area, minEquity: min, maxEquity: max, isPositive: end >= start };
  }, [multi, points, height]);

  if (multi) {
    return (
      <div className="w-full" data-testid="equity-curve-multi">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height }}
        >
          {multi.paths.map((p, i) => (
            p.d ? <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth="1.5" /> : null
          ))}
        </svg>
        <div className="flex flex-wrap gap-2 text-[10px] mt-1 font-mono">
          {multi.paths.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-[2px]" style={{ backgroundColor: p.color }} />
              <span style={{ color: p.color }}>{p.label}</span>
            </span>
          ))}
          <span className="ml-auto text-[#475569]">
            ${multi.min.toLocaleString()} - ${multi.max.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  const { path, minEquity, maxEquity, isPositive } = single!;
  const color = isPositive ? '#34d399' : '#ef4444';
  const gradientId = `equity-gradient-${algoId.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {path && (
          <path d={path} fill={`url(#${gradientId})`} stroke={color} strokeWidth="1.5" />
        )}
      </svg>
      <div className="flex justify-between text-xs mt-1 font-mono">
        <span className="text-[#475569]">${minEquity.toLocaleString()}</span>
        <span style={{ color }}>${maxEquity.toLocaleString()}</span>
      </div>
    </div>
  );
}
