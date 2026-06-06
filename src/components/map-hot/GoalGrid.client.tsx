'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { GoalCard } from './GoalCard';
import { GoalFormModal } from './GoalFormModal.client';
import { ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';

import { logError } from "@/lib/log";
type GoalStatus = 'ON_TRACK' | 'BELOW_PACE' | 'EXCEEDED' | 'WARNING';
type GoalTimeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';

interface LinkedAlgorithm {
  id: string;
  name: string;
  status: string | null;
}

interface ApiGoal {
  id: string;
  name: string;
  timeframe: GoalTimeframe;
  target_value: number;
  current_value: number;
  unit: string;
  status: GoalStatus;
  due_date: string | null;
  linked_algorithms?: LinkedAlgorithm[];
}

interface UiGoal {
  id: string;
  name: string;
  timeframe: GoalTimeframe;
  targetValue: number;
  currentValue: number;
  status: GoalStatus;
  unit: string;
  linkedAlgorithms: LinkedAlgorithm[];
  linkedAlgoIds: string[];
  daysLeft?: number;
}

const TIMEFRAME_ORDER: GoalTimeframe[] = ['annual', 'quarterly', 'monthly', 'weekly'];
const TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  weekly: 'Weekly',
};

const daysUntil = (dueDate: string | null): number | undefined => {
  if (!dueDate) return undefined;
  const due = new Date(dueDate + 'T00:00:00Z').getTime();
  if (!Number.isFinite(due)) return undefined;
  const today = Date.now();
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

const apiToUi = (g: ApiGoal): UiGoal => ({
  id: g.id,
  name: g.name,
  timeframe: g.timeframe,
  targetValue: Number(g.target_value),
  currentValue: Number(g.current_value),
  status: g.status,
  unit: g.unit,
  linkedAlgorithms: g.linked_algorithms ?? [],
  linkedAlgoIds: (g.linked_algorithms ?? []).map((a) => a.id),
  daysLeft: daysUntil(g.due_date),
});

const readCsrf = (): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)al_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export function GoalGrid() {
  const [goals, setGoals] = useState<UiGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UiGoal | null>(null);
  const [activeFilter, setActiveFilter] = useState<GoalTimeframe | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/map-hot/goals', { credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiGoal[];
      setGoals(data.map(apiToUi));
    } catch (err) {
      logError('GoalGrid', { component: 'goalgrid', message: 'Error loading map-hot goals', error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const handleSave = async (data: {
    name: string;
    timeframe: GoalTimeframe;
    target_value: number;
    current_value: number;
    unit: string;
    linked_algo_ids: string[];
    status: GoalStatus;
  }) => {
    const isEditing = Boolean(editingGoal);
    const url = isEditing
      ? `/api/map-hot/goals/${editingGoal!.id}`
      : '/api/map-hot/goals';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': readCsrf(),
        },
        body: JSON.stringify({
          name: data.name,
          timeframe: data.timeframe,
          target_value: data.target_value,
          current_value: data.current_value,
          unit: data.unit,
          linked_algorithm_ids: data.linked_algo_ids,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      toast.success(isEditing ? 'Goal updated' : 'Goal created');
      setEditingGoal(null);
      await loadGoals();
    } catch (err) {
      logError('GoalGrid', { component: 'goalgrid', message: 'Error saving goal', error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to save goal');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/map-hot/goals/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': readCsrf() },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success('Goal deleted');
      setConfirmDeleteId(null);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      logError('GoalGrid', { component: 'goalgrid', message: 'Error deleting goal', error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  };

  const filteredGoals = activeFilter === 'all'
    ? goals
    : goals.filter((g) => g.timeframe === activeFilter);

  const grouped = TIMEFRAME_ORDER.reduce<Record<GoalTimeframe, UiGoal[]>>(
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

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      )}

      {/* Goals by timeframe */}
      {!loading && TIMEFRAME_ORDER.map((tf) => {
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
                  onDelete={() => setConfirmDeleteId(goal.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {!loading && filteredGoals.length === 0 && (
        <EmptyState
          title="No goals yet"
          message={
            activeFilter === 'all'
              ? 'Create your first goal to start tracking progress.'
              : `No ${TIMEFRAME_LABELS[activeFilter as GoalTimeframe].toLowerCase()} goals yet.`
          }
          action={
            <button
              onClick={() => { setEditingGoal(null); setShowForm(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-[#eab308] hover:bg-[#d99e08] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
            >
              <Plus size={15} />
              New Goal
            </button>
          }
        />
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
            linkedAlgoIds: editingGoal.linkedAlgoIds,
          } : undefined}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => { if (confirmDeleteId) await handleDelete(confirmDeleteId); }}
        title="Delete goal?"
        message="This goal will be moved to the trash. You can restore it later from the API."
        variant="danger"
        confirmLabel="Delete"
      />
    </>
  );
}
