interface Goal {
  status: 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';
}

interface Props {
  goals: Goal[];
}

const STATUS_CONFIG = [
  { key: 'EXCEEDED',   label: 'Exceeded',   color: '#22d3ee' },
  { key: 'ON_TRACK',   label: 'On Track',   color: '#34d399' },
  { key: 'BELOW_PACE', label: 'Below Pace', color: '#eab308' },
  { key: 'WARNING',    label: 'At Risk',    color: '#ef4444' },
] as const;

export function ProgressDistributionDonut({ goals }: Props) {
  const total = goals.length;
  const counts = STATUS_CONFIG.map((cfg) => ({
    ...cfg,
    count: goals.filter((g) => g.status === cfg.key).length,
  }));

  // SVG donut params
  const size = 180;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute cumulative offsets so the render is immutable (React Compiler).
  const segments = counts.reduce<Array<{ key: string; color: string; length: number; offset: number }>>(
    (acc, c) => {
      if (c.count === 0) return acc;
      const length = circumference * (c.count / total);
      const prev = acc[acc.length - 1];
      const offset = prev ? prev.offset + prev.length : 0;
      acc.push({ key: c.key, color: c.color, length, offset });
      return acc;
    },
    []
  );

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
      <h3 className="text-sm font-bold text-[#e2e8f0] mb-4">Distribution by status</h3>

      {total === 0 ? (
        <p className="text-center text-xs text-[#475569] py-12">No goals to display.</p>
      ) : (
        <div className="flex items-center gap-6">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1f2937"
              strokeWidth={stroke}
            />
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
              />
            ))}
            <text
              x={size / 2}
              y={size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="rotate-90"
              transform={`rotate(90 ${size / 2} ${size / 2})`}
              fill="#e2e8f0"
              fontSize="28"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {total}
            </text>
          </svg>

          <ul className="flex-1 space-y-2">
            {counts.map((c) => (
              <li key={c.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-[#94a3b8]">{c.label}</span>
                </span>
                <span className="font-mono font-bold" style={{ color: c.color }}>
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
