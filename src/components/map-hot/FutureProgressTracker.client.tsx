'use client';

import { useCallback, useEffect, useState } from 'react';
import { Rocket, CheckCircle2, Circle, Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import { MilestoneFormModal } from './MilestoneFormModal.client';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type MilestoneStatus = 'completed' | 'active' | 'upcoming';

interface ApiMilestone {
  id: string;
  year: number;
  quarter: Quarter;
  label: string;
  target_amount: number;
  description: string | null;
  status: MilestoneStatus;
}

const QUARTER_ORDER: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const STATUS_CONFIG: Record<MilestoneStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: '#34d399', label: 'Complete' },
  active:    { icon: Clock,        color: '#22d3ee', label: 'Active' },
  upcoming:  { icon: Circle,       color: '#475569', label: 'Planned' },
};

const readCsrf = (): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)al_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const formatMoney = (value: number): string => `$${value.toLocaleString('en-US')}`;

export function FutureProgressTracker() {
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);
  const [milestones, setMilestones] = useState<ApiMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiMilestone | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/map-hot/milestones?year=${year}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiMilestone[];
      const sorted = [...data].sort(
        (a, b) => QUARTER_ORDER.indexOf(a.quarter) - QUARTER_ORDER.indexOf(b.quarter)
      );
      setMilestones(sorted);
    } catch (err) {
      console.error('Error loading milestones:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (data: {
    year: number;
    quarter: Quarter;
    label: string;
    target_amount: number;
    description: string | null;
    status: MilestoneStatus;
  }) => {
    const isEditing = Boolean(editing);
    const url = isEditing ? `/api/map-hot/milestones/${editing!.id}` : '/api/map-hot/milestones';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': readCsrf(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success(isEditing ? 'Milestone updated' : 'Milestone created');
      setEditing(null);
      await load();
    } catch (err) {
      console.error('Error saving milestone:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save milestone');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/map-hot/milestones/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': readCsrf() },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success('Milestone deleted');
      setConfirmDeleteId(null);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Error deleting milestone:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete milestone');
    }
  };

  const annualTarget = milestones.reduce((sum, m) => sum + m.target_amount, 0);
  const completedTarget = milestones
    .filter((m) => m.status === 'completed')
    .reduce((sum, m) => sum + m.target_amount, 0);
  const progressPct = annualTarget > 0 ? (completedTarget / annualTarget) * 100 : 0;
  const completedCount = milestones.filter((m) => m.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header with Add */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-[#c084fc] hover:bg-[#a855f7] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
        >
          <Plus size={15} />
          New Milestone
        </button>
      </div>

      {/* Annual overview */}
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Rocket size={18} className="text-[#c084fc]" />
          <h2 className="text-sm font-bold text-[#e2e8f0]">Annual Vision {year}</h2>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-3xl font-bold font-mono text-[#c084fc]">
              {formatMoney(annualTarget)}
            </div>
            <div className="text-xs text-[#475569] mt-0.5">Annual revenue target</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-[#e2e8f0]">
              {progressPct.toFixed(1)}%
            </div>
            <div className="text-xs text-[#475569] mt-0.5">year progress</div>
          </div>
        </div>

        <div className="h-3 bg-[#0a0e1a] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #c084fc, #22d3ee)',
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-[#475569]">
          <span>Jan {year}</span>
          <span className="text-[#c084fc]">{completedCount}/{milestones.length} quarters complete</span>
          <span>Dec {year}</span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && milestones.length === 0 && (
        <EmptyState
          title="No milestones yet"
          message={`Plan your ${year} quarterly milestones to track Annual Vision progress.`}
          action={
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-[#c084fc] hover:bg-[#a855f7] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
            >
              <Plus size={15} />
              New Milestone
            </button>
          }
        />
      )}

      {/* Quarterly milestones */}
      {!loading && milestones.length > 0 && (
        <div className="relative">
          <div className="absolute left-5 top-6 bottom-6 w-px bg-[#1f2937]" />

          <div className="space-y-4">
            {milestones.map((milestone) => {
              const cfg = STATUS_CONFIG[milestone.status];
              const Icon = cfg.icon;

              return (
                <div key={milestone.id} className="relative flex gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-[#0a0e1a] z-10"
                    style={{ borderColor: cfg.color }}
                  >
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>

                  <div
                    className={`flex-1 bg-[#151b28] border rounded-lg p-4 transition-colors ${
                      milestone.status === 'active'
                        ? 'border-[#22d3ee]/30'
                        : milestone.status === 'completed'
                        ? 'border-[#34d399]/20'
                        : 'border-[#1f2937]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded font-mono flex-shrink-0"
                          style={{
                            backgroundColor: `${cfg.color}15`,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}30`,
                          }}
                        >
                          {milestone.quarter}
                        </span>
                        <span className="text-sm font-bold text-[#e2e8f0] truncate">{milestone.label}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm font-bold font-mono mr-2" style={{ color: cfg.color }}>
                          {formatMoney(milestone.target_amount)}
                        </span>
                        <button
                          onClick={() => { setEditing(milestone); setShowForm(true); }}
                          className="p-1 hover:bg-[#0a0e1a] rounded transition-colors"
                          aria-label="Edit milestone"
                        >
                          <Edit2 size={13} className="text-[#475569]" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(milestone.id)}
                          className="p-1 hover:bg-[#0a0e1a] rounded transition-colors"
                          aria-label="Delete milestone"
                        >
                          <Trash2 size={13} className="text-[#475569] hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {milestone.description && (
                      <p className="text-xs text-[#475569] leading-relaxed">{milestone.description}</p>
                    )}

                    <div
                      className="mt-2 text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <MilestoneFormModal
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
          initialData={editing ? {
            year: editing.year.toString(),
            quarter: editing.quarter,
            label: editing.label,
            targetAmount: editing.target_amount.toString(),
            description: editing.description ?? '',
            status: editing.status,
          } : undefined}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => { if (confirmDeleteId) await handleDelete(confirmDeleteId); }}
        title="Delete milestone?"
        message="This milestone will be moved to the trash."
        variant="danger"
        confirmLabel="Delete"
      />
    </div>
  );
}
