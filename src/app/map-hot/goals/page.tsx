import { Target, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

const PLACEHOLDER_GOALS = [
  { id: '1', name: 'Annual Revenue Target', timeframe: 'annual', target_value: 120000, current_value: 67500, status: 'ON_TRACK' },
  { id: '2', name: 'Q2 Trading P&L', timeframe: 'quarterly', target_value: 30000, current_value: 12400, status: 'BELOW_PACE' },
  { id: '3', name: 'Win Rate Improvement', timeframe: 'monthly', target_value: 70, current_value: 68, status: 'ON_TRACK' },
];

const STATUS_COLORS: Record<string, string> = {
  ON_TRACK: '#34d399',
  BELOW_PACE: '#eab308',
  EXCEEDED: '#22d3ee',
  WARNING: '#ef4444',
};

export default function GoalsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <Target size={22} className="text-[#eab308]" />
            Goals
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Track your targets across all timeframes</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-[#eab308] hover:bg-[#d99e08] text-[#0a0e1a] text-sm font-bold rounded transition-colors">
          <Plus size={16} />
          New Goal
        </button>
      </div>

      <div className="space-y-4">
        {PLACEHOLDER_GOALS.map((goal) => {
          const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
          const statusColor = STATUS_COLORS[goal.status] || '#94a3b8';
          const statusVariant = goal.status === 'ON_TRACK' || goal.status === 'EXCEEDED' ? 'success' : goal.status === 'WARNING' ? 'error' : 'warning';
          return (
            <div key={goal.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5 hover:border-[#eab308]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#e2e8f0]">{goal.name}</h3>
                  <p className="text-xs text-[#475569] capitalize mt-0.5">{goal.timeframe}</p>
                </div>
                <Badge variant={statusVariant}>{goal.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#94a3b8]">{goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()}</span>
                  <span className="font-mono" style={{ color: statusColor }}>{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#0a0e1a] rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${progress}%`, backgroundColor: statusColor }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
