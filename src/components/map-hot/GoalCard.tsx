import Link from 'next/link';
import { Badge } from '@/components/shared/Badge';
import { Target, TrendingUp, Calendar, Edit2, Trash2 } from 'lucide-react';

type GoalStatus = 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';
type GoalTimeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';

export interface LinkedAlgorithm {
  id: string;
  name: string;
  status: string | null;
}

interface GoalCardProps {
  id: string;
  name: string;
  timeframe: GoalTimeframe;
  targetValue: number;
  currentValue: number;
  status: GoalStatus;
  unit?: string;
  linkedAlgorithms?: LinkedAlgorithm[];
  daysLeft?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

const algoStatusColor = (status: string | null): string => {
  if (status === 'live') return '#22d3ee';
  if (status === 'paper') return '#eab308';
  if (status === 'paused') return '#94a3b8';
  return '#475569';
};

const STATUS_CONFIG: Record<GoalStatus, { variant: 'success' | 'warning' | 'error' | 'info'; color: string }> = {
  ON_TRACK:   { variant: 'success', color: '#34d399' },
  EXCEEDED:   { variant: 'info',    color: '#22d3ee' },
  BELOW_PACE: { variant: 'warning', color: '#eab308' },
  WARNING:    { variant: 'error',   color: '#ef4444' },
};

const TIMEFRAME_ICONS: Record<GoalTimeframe, typeof Target> = {
  annual:    Calendar,
  quarterly: TrendingUp,
  monthly:   Target,
  weekly:    Target,
};

export function GoalCard({
  name,
  timeframe,
  targetValue,
  currentValue,
  status,
  unit = '',
  linkedAlgorithms = [],
  daysLeft,
  onEdit,
  onDelete,
}: GoalCardProps) {
  const cfg = STATUS_CONFIG[status];
  const progress = Math.min((currentValue / targetValue) * 100, 100);
  const remaining = targetValue - currentValue;
  const Icon = TIMEFRAME_ICONS[timeframe];

  // Pace calculation: how much per day is needed
  const dailyNeeded = daysLeft && daysLeft > 0 && remaining > 0
    ? remaining / daysLeft
    : null;

  return (
    <div
      className="bg-[#151b28] border rounded-lg p-5 transition-colors"
      style={{ borderColor: progress >= 100 ? `${cfg.color}40` : '#1f2937' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-2 flex-1 pr-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
          >
            <Icon size={15} style={{ color: cfg.color }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#e2e8f0] leading-snug">{name}</h3>
            <p className="text-xs text-[#475569] capitalize mt-0.5">{timeframe}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant={cfg.variant}>{status.replace('_', ' ')}</Badge>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 hover:bg-[#0a0e1a] rounded transition-colors ml-1"
              aria-label="Edit goal"
            >
              <Edit2 size={13} className="text-[#475569]" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-[#0a0e1a] rounded transition-colors"
              aria-label="Delete goal"
            >
              <Trash2 size={13} className="text-[#475569] hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Values */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>
            {unit}{currentValue.toLocaleString()}
          </div>
          <div className="text-xs text-[#475569]">
            of {unit}{targetValue.toLocaleString()} target
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-[#e2e8f0]">
            {progress.toFixed(1)}%
          </div>
          <div className="text-xs text-[#475569]">complete</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2.5 bg-[#0a0e1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: cfg.color }}
          />
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs">
        <div className="text-[#475569]">
          {remaining > 0
            ? `${unit}${remaining.toLocaleString()} remaining`
            : <span style={{ color: cfg.color }}>Goal achieved!</span>}
        </div>
        {dailyNeeded && (
          <div className="text-[#94a3b8]">
            {unit}{dailyNeeded.toFixed(0)}/day needed
          </div>
        )}
      </div>

      {/* Linked algorithms */}
      {linkedAlgorithms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[#1f2937]">
          {linkedAlgorithms.map((algo) => {
            const color = algoStatusColor(algo.status);
            return (
              <Link
                key={algo.id}
                href={`/intelligence/algorithms?id=${algo.id}`}
                className="text-[10px] px-2 py-0.5 rounded border transition-opacity hover:opacity-80"
                style={{
                  borderColor: `${color}33`,
                  backgroundColor: `${color}15`,
                  color,
                }}
              >
                {algo.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
