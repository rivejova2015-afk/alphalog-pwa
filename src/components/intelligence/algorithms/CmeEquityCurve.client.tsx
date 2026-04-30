'use client';

import { useEffect, useState } from 'react';

interface Snapshot {
  equity_usd: number;
  daily_pnl_usd: number;
  snapshot_at: string;
}

interface Props {
  cmeAccountId: string;
  height?: number;
}

export default function CmeEquityCurve({ cmeAccountId, height = 120 }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cme/account/equity-snapshots?cmeAccountId=${cmeAccountId}&limit=100`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }) => setSnapshots(data ?? []))
      .finally(() => setLoading(false));
  }, [cmeAccountId]);

  if (loading) {
    return <div className="rounded-lg bg-white/5 animate-pulse" style={{ height }} />;
  }

  if (snapshots.length < 2) {
    return (
      <div className="flex items-center justify-center text-white/30 text-sm rounded-lg bg-white/5" style={{ height }}>
        Not enough data yet
      </div>
    );
  }

  const values = snapshots.map(s => Number(s.equity_usd));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 400;
  const pad = 4;
  const plotH = height - pad * 2;

  const points = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * w;
    const y = pad + plotH - ((Number(s.equity_usd) - min) / range) * plotH;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const isUp = lastVal >= firstVal;

  const areaPoints = `0,${height} ${points.join(' ')} ${w},${height}`;

  return (
    <div className="rounded-lg overflow-hidden bg-white/5 relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`cme-grad-${cmeAccountId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={areaPoints}
          fill={`url(#cme-grad-${cmeAccountId})`}
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={isUp ? '#10b981' : '#f43f5e'}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute bottom-2 right-3 text-xs text-white/50">
        ${lastVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}
