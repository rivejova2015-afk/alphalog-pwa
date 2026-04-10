'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { GoalCard } from './GoalCard';
import { GoalFormModal } from './GoalFormModal.client';

type GoalStatus = 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';
type GoalTimeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';

interface Goal {
  id: string;
  name: string;
  timeframe: GoalTimeframe;
  targetValue: number;
  currentValue: number;
  status: GoalStatus;
  unit: string;
  linkedAlgos: string[];
  daysLeft?: number;
}

const INITIAL_GOALS: Goal[] = [
  { id: '1', name: 'Annual Revenue Target', timeframe: 'annual', targetValue: 120000, currentValue: 67500, status: 'ON_TRACK', unit: '$', linkedAlgos: ['GoldRange Basket v3', 'ES Futures Mean Rev'], daysLeft: 267 },
  { id: '2', name: 'Q2 Trading P&L', timeframe: 'quarterly', targetValue: 30000, currentValue: 12400, status: 'BELOW_PACE', unit: '$', linkedAlgos: ['GoldRange Basket v3'], daysLeft: 53 },
  { id: '3', name: 'Win Rate Improvement', timeframe: 'monthly', targetValue: 70, currentValue: 68.4, status: 'ON_TRACK', unit: '', linkedAlgos: [], daysLeft: 21 },
  { id: '4', name: 'Max Drawdown Control', timeframe: 'monthly', targetValue: 8, currentValue: 6.8, status: 'EXCEEDED', unit: '-', linkedAlgos: ['GoldRange Basket v3'], daysLeft: 21 },
];

const TIMEFRAME_ORDER: GoalTimeframe[] = ['annual', 'quarterly', 'monthly', 'weekly'];
const TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  weekly: 'Weekly',
};

export function GoalGrid() {
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [activeFilter, setActiveFilter] = useState<GoalTimeframe | 'all'>('all');

  const handleSave = (data: {
    name: string;
    timeframe: GoalTimeframe;
    target_value: number;
    current_value: number;
    unit: string;
    linked_algo_ids: string[];
    status: GoalStatus;
  }) => {
    if (editingGoal) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === editingGoal.id
            ? { ...g, name: data.name, timeframe: data.timeframe, targetValue: data.target_value, currentValue: data.current_value, unit: data.unit, linkedAlgos: data.linked_algo_ids, status: data.status }
            : g
        )
      );
    } else {
      const newGoal: Goal = {
        id: Date.now().toString(),
        name: data.name,
        timeframe: data.timeframe,
        targetValue: data.target_value,
        currentValue: data.current_value,
        status: data.status,
        unit: data.unit,
        linkedAlgos: data.linked_algo_ids,
      };
      setGoals((prev) => [newGoal, ...prev]);
    }
    setEditingGoal(null);
  };

  const filteredGoals = activeFilter === 'all'
    ? goals
    : goals.filter((g) => g.timeframe === activeFilter);

  const grouped = TIMEFRAME_ORDER.reduce<Record<GoalTimeframe, Goal[]>>(
    (acc, tf) => {
      acc[tf] = filteredGoals.filter((g) => g.timeframe === tf);
      return acc;
    },
    { annual: [], quarterly: [], monthly: [], weekly: [] }
  );

  return (
    <>
      {/* Filters + Add */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(['all', ...TIMEFRAME_ORDER] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveFilter(tf)}
              className={`px-3 py-1.5 text-xs font-bold rounded capitalize transition-colors ${
                activeFilter === tf
                  ? 'bg-[#eab308] text-[#0a0e1a]'
                  : 'bg-[#151b28] border border-[#1f2937] text-[#94a3b8] hover:border-[#eab308]/30'
              }`}
            >
              {tf === 'all' ? 'All' : TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingGoal(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-[#eab308] hover:bg-[#d99e08] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
        >
          <Plus size={15} />
          New Goal
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Goals', value: goals.length.toString(), color: '#e2e8f0' },
          { label: 'On Track', value: goals.filter((g) => g.status === 'ON_TRACK' || g.status === 'EXCEEDED').length.toString(), color: '#34d399' },
          { label: 'Below Pace', value: goals.filter((g) => g.status === 'BELOW_PACE').length.toString(), color: '#eab308' },
          { label: 'At Risk', value: goals.filter((g) => g.status === 'WARNING').length.toString(), color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{s.label}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Goals by timeframe */}
      {TIMEFRAME_ORDER.map((tf) => {
        const tfGoals = grouped[tf];
        if (tfGoals.length === 0) return null;
        return (
          <div key={tf} className="mb-8">
            <p className="text-xs text-[#475569] uppercase tracking-wider font-medium mb-3">
              {TIMEFRAME_LABELS[tf]}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tfGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  {...goal}
                  onEdit={() => {
                    setEditingGoal(goal);
                    setShowForm(true);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filteredGoals.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#475569] text-sm">No goals for this timeframe yet.</p>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <GoalFormModal
          onClose={() => { setShowForm(false); setEditingGoal(null); }}
          onSave={handleSave}
          initialData={editingGoal ? {
            name: editingGoal.name,
            timeframe: editingGoal.timeframe,
            targetValue: editingGoal.targetValue.toString(),
            currentValue: editingGoal.currentValue.toString(),
            unit: editingGoal.unit,
            linkedAlgos: editingGoal.linkedAlgos.join(', '),
          } : undefined}
        />
      )}
    </>
  );
}
