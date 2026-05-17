'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui';

interface SnapshotPoint {
  recorded_at: string;
  current_value: number;
}

interface ApiResponse {
  goal_id: string;
  days: number;
  points: SnapshotPoint[];
}

interface GoalForChart {
  id: string;
  name: string;
  target_value: number;
  unit: string;
}

interface Props {
  goals: GoalForChart[];
  daysWindow?: number;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 12, right: 16, bottom: 24, left: 48 };

const formatDate = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
};

export function GoalHistoryChart({ goals, daysWindow = 30 }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(goals[0]?.id ?? null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedGoal = goals.find((g) => g.id === selectedId) ?? null;

  const load = useCallback(async (goalId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/map-hot/goals/${goalId}/snapshots?days=${daysWindow}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      console.error('Error loading goal snapshots:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load history');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [daysWindow]);

  useEffect(() => {
    if (selectedId) {
      void load(selectedId);
    }
  }, [selectedId, load]);

  if (goals.length === 0) {
    return null;
  }

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Compute series for the SVG
  const points = data?.points ?? [];
  const target = selectedGoal?.target_value ?? 0;
  const values = points.map((p) => p.current_value);
  const maxValue = Math.max(target, ...values, 1);
  const minValue = 0;
  const valueRange = maxValue - minValue || 1;

  const x = (i: number): number =>
    points.length <= 1
      ? PADDING.left + innerWidth / 2
      : PADDING.left + (i / (points.length - 1)) * innerWidth;
  const y = (v: number): number =>
    PADDING.top + innerHeight - ((v - minValue) / valueRange) * innerHeight;

  const linePath = points.length > 0
    ? points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.current_value).toFixed(1)}`)
        .join(' ')
    : '';

  const targetY = y(target);

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#22d3ee]" />
          <h3 className="text-sm font-bold text-[#e2e8f0]">Goal history (last {daysWindow} days)</h3>
        </div>
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="bg-[#0a0e1a] border border-[#1f2937] rounded px-3 py-1.5 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#22d3ee]/50"
        >
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] rounded" />
      ) : points.length === 0 ? (
        <p className="text-xs text-[#475569] text-center py-12">
          No snapshots yet for this goal. The daily cron will populate this chart over time.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-auto"
          role="img"
          aria-label={`History chart for ${selectedGoal?.name}`}
        >
          {/* Y-axis labels */}
          {[0, 0.5, 1].map((frac) => {
            const value = minValue + valueRange * frac;
            const yPos = PADDING.top + innerHeight * (1 - frac);
            return (
              <g key={frac}>
                <line
                  x1={PADDING.left}
                  y1={yPos}
                  x2={PADDING.left + innerWidth}
                  y2={yPos}
                  stroke="#1f2937"
                  strokeDasharray="2 4"
                />
                <text
                  x={PADDING.left - 6}
                  y={yPos + 4}
                  fill="#475569"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {selectedGoal?.unit}{value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </text>
              </g>
            );
          })}

          {/* Target line */}
          {target > 0 && target <= maxValue && (
            <g>
              <line
                x1={PADDING.left}
                y1={targetY}
                x2={PADDING.left + innerWidth}
                y2={targetY}
                stroke="#34d399"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={PADDING.left + innerWidth - 4}
                y={targetY - 4}
                fill="#34d399"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                target {selectedGoal?.unit}{target.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </text>
            </g>
          )}

          {/* X-axis labels (first, middle, last) */}
          {points.length > 0 && (
            <>
              <text
                x={x(0)}
                y={CHART_HEIGHT - 6}
                fill="#475569"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="start"
              >
                {formatDate(points[0].recorded_at)}
              </text>
              {points.length >= 3 && (
                <text
                  x={x(Math.floor(points.length / 2))}
                  y={CHART_HEIGHT - 6}
                  fill="#475569"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {formatDate(points[Math.floor(points.length / 2)].recorded_at)}
                </text>
              )}
              <text
                x={x(points.length - 1)}
                y={CHART_HEIGHT - 6}
                fill="#475569"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                {formatDate(points[points.length - 1].recorded_at)}
              </text>
            </>
          )}

          {/* Line */}
          <path d={linePath} fill="none" stroke="#22d3ee" strokeWidth="2" />

          {/* Dots */}
          {points.map((p, i) => (
            <circle
              key={p.recorded_at}
              cx={x(i)}
              cy={y(p.current_value)}
              r="2.5"
              fill="#22d3ee"
            >
              <title>{`${p.recorded_at}: ${selectedGoal?.unit}${p.current_value.toLocaleString('en-US')}`}</title>
            </circle>
          ))}
        </svg>
      )}
    </div>
  );
}
