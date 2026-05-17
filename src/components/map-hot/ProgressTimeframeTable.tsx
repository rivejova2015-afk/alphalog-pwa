type Timeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';

interface Goal {
  timeframe: Timeframe;
  target_value: number;
  current_value: number;
  unit: string;
}

interface Props {
  goals: Goal[];
}

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  weekly: 'Weekly',
};

const TIMEFRAMES: Timeframe[] = ['annual', 'quarterly', 'monthly', 'weekly'];

export function ProgressTimeframeTable({ goals }: Props) {
  const rows = TIMEFRAMES.map((tf) => {
    const subset = goals.filter((g) => g.timeframe === tf);
    const totalTarget = subset.reduce((sum, g) => sum + g.target_value, 0);
    const totalCurrent = subset.reduce((sum, g) => sum + g.current_value, 0);
    const totalRemaining = Math.max(totalTarget - totalCurrent, 0);
    const avgPct = subset.length > 0
      ? (subset.reduce((sum, g) => sum + (g.target_value > 0 ? Math.min(g.current_value / g.target_value, 1) : 0), 0) / subset.length) * 100
      : 0;
    return {
      timeframe: tf,
      count: subset.length,
      avgPct,
      totalRemaining,
    };
  });

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
      <h3 className="text-sm font-bold text-[#e2e8f0] mb-4">Breakdown by timeframe</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[#475569]">
              <th className="text-left font-medium pb-2">Timeframe</th>
              <th className="text-right font-medium pb-2">Goals</th>
              <th className="text-right font-medium pb-2">Avg complete</th>
              <th className="text-right font-medium pb-2">$ remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.timeframe} className="border-t border-[#1f2937]">
                <td className="py-2.5 text-[#e2e8f0] capitalize">{TIMEFRAME_LABEL[row.timeframe]}</td>
                <td className="py-2.5 text-right font-mono text-[#94a3b8]">{row.count}</td>
                <td className="py-2.5 text-right font-mono text-[#94a3b8]">
                  {row.count > 0 ? `${row.avgPct.toFixed(1)}%` : '—'}
                </td>
                <td className="py-2.5 text-right font-mono text-[#94a3b8]">
                  {row.count > 0 ? `$${row.totalRemaining.toLocaleString('en-US')}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
