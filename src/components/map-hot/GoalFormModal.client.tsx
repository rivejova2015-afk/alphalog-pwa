'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AlgorithmMultiSelect } from './AlgorithmMultiSelect.client';
import { computeGoalStatus, type GoalStatus } from '@/lib/map-hot/goalStatus';

type GoalTimeframe = 'annual' | 'quarterly' | 'monthly' | 'weekly';

interface GoalFormData {
  name: string;
  timeframe: GoalTimeframe;
  targetValue: string;
  currentValue: string;
  unit: string;
  linkedAlgoIds: string[];
}

interface GoalFormModalProps {
  onClose: () => void;
  onSave: (data: {
    name: string;
    timeframe: GoalTimeframe;
    target_value: number;
    current_value: number;
    unit: string;
    linked_algo_ids: string[];
    status: GoalStatus;
  }) => void;
  initialData?: Partial<GoalFormData>;
}

const TIMEFRAMES: GoalTimeframe[] = ['annual', 'quarterly', 'monthly', 'weekly'];

export function GoalFormModal({ onClose, onSave, initialData }: GoalFormModalProps) {
  const [form, setForm] = useState<GoalFormData>({
    name: initialData?.name ?? '',
    timeframe: initialData?.timeframe ?? 'quarterly',
    targetValue: initialData?.targetValue ?? '',
    currentValue: initialData?.currentValue ?? '0',
    unit: initialData?.unit ?? '$',
    linkedAlgoIds: initialData?.linkedAlgoIds ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Goal name is required'); return; }
    const target = parseFloat(form.targetValue);
    if (isNaN(target) || target <= 0) { setError('Target value must be a positive number'); return; }

    setSaving(true);
    const current = parseFloat(form.currentValue) || 0;
    const status: GoalStatus = computeGoalStatus(current, target);

    onSave({
      name: form.name.trim(),
      timeframe: form.timeframe,
      target_value: target,
      current_value: current,
      unit: form.unit,
      linked_algo_ids: form.linkedAlgoIds,
      status,
    });
    setSaving(false);
    onClose();
  };

  const setField = <K extends keyof GoalFormData>(key: K, val: GoalFormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0a0e1a] border border-[#1f2937] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
          <h2 className="text-base font-bold text-[#e2e8f0] font-mono">
            {initialData?.name ? 'Edit Goal' : 'New Goal'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#151b28] rounded transition-colors" aria-label="Close">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Goal Name *</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Annual Revenue Target"
              className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#eab308]/50"
            />
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Timeframe</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setField('timeframe', tf)}
                  className={`py-2 text-xs font-bold rounded capitalize transition-colors ${
                    form.timeframe === tf
                      ? 'bg-[#eab308] text-[#0a0e1a]'
                      : 'bg-[#151b28] border border-[#1f2937] text-[#94a3b8] hover:border-[#eab308]/30'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#475569] block mb-1.5">Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                placeholder="$"
                className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#eab308]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#475569] block mb-1.5">Target *</label>
              <input
                type="number"
                value={form.targetValue}
                onChange={(e) => setField('targetValue', e.target.value)}
                placeholder="120000"
                className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#eab308]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#475569] block mb-1.5">Current</label>
              <input
                type="number"
                value={form.currentValue}
                onChange={(e) => setField('currentValue', e.target.value)}
                placeholder="0"
                className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#eab308]/50"
              />
            </div>
          </div>

          {/* Linked algorithms (FK to public.algorithms) */}
          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Linked algorithms</label>
            <AlgorithmMultiSelect
              value={form.linkedAlgoIds}
              onChange={(next) => setField('linkedAlgoIds', next)}
            />
          </div>

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[#1f2937]">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] border border-[#1f2937] hover:border-[#2d3748] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 text-sm font-bold bg-[#eab308] hover:bg-[#d99e08] text-[#0a0e1a] rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
