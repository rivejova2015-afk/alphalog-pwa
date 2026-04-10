'use client';

import { useMemo } from 'react';

interface EquityPoint {
  date: string;
  equity: number;
}

interface EquityCurveProps {
  points?: EquityPoint[];
  height?: number;
}

// Generate demo equity curve
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

export function EquityCurve({ points = DEMO_POINTS, height = 120 }: EquityCurveProps) {
  const { path, minEquity, maxEquity, isPositive } = useMemo(() => {
    if (points.length < 2) return { path: '', minEquity: 0, maxEquity: 0, isPositive: true };

    const equities = points.map((p) => p.equity);
    const min = Math.min(...equities);
    const max = Math.max(...equities);
    const range = max - min || 1;

    const w = 100;
    const h = height;
    const pad = 4;

    const coords = points.map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + ((max - p.equity) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const line = `M ${coords.join(' L ')}`;
    const area = `${line} L ${100 - pad},${h - pad} L ${pad},${h - pad} Z`;

    const start = points[0].equity;
    const end = points[points.length - 1].equity;

    return { path: area, linePath: line, minEquity: min, maxEquity: max, isPositive: end >= start };
  }, [points, height]);

  const color = isPositive ? '#34d399' : '#ef4444';
  const gradientId = `equity-gradient-${Math.random().toString(36).slice(2, 7)}`;

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
