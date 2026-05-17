import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  target_value: number;
  current_value: number;
  status: 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';
  due_date: string | null;
  unit: string;
}

interface Props {
  goals: Goal[];
}

const daysUntil = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T00:00:00Z').getTime();
  if (!Number.isFinite(due)) return null;
  const diff = Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

export function AtRiskGoalsList({ goals }: Props) {
  const atRisk = goals
    .map((g) => ({ ...g, daysLeft: daysUntil(g.due_date) }))
    .filter((g) => {
      if (g.status === 'WARNING') return true;
      const progress = g.target_value > 0 ? g.current_value / g.target_value : 0;
      if (progress < 0.4 && g.daysLeft !== null && g.daysLeft <= 14) return true;
      return false;
    })
    .sort((a, b) => {
      // Sort by daysLeft asc (nulls last)
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-[#ef4444]" />
        <h3 className="text-sm font-bold text-[#e2e8f0]">At-risk goals</h3>
        {atRisk.length > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
            {atRisk.length}
          </span>
        )}
      </div>

      {atRisk.length === 0 ? (
        <p className="text-xs text-[#475569] text-center py-6">
          All goals on track. Nice.
        </p>
      ) : (
        <ul className="space-y-2">
          {atRisk.map((g) => {
            const progress = g.target_value > 0 ? (g.current_value / g.target_value) * 100 : 0;
            return (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 p-3 bg-[#0a0e1a] rounded border border-[#1f2937]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#e2e8f0] truncate">{g.name}</p>
                  <p className="text-[10px] text-[#475569] mt-0.5">
                    {progress.toFixed(0)}% complete
                    {g.daysLeft !== null && ` · ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left`}
                  </p>
                </div>
                <Link
                  href="/map-hot/goals"
                  className="text-[10px] font-bold px-2 py-1 rounded bg-[#eab308]/10 border border-[#eab308]/30 text-[#eab308] hover:bg-[#eab308]/20 transition-colors flex-shrink-0"
                >
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
