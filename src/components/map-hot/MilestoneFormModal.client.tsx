'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type Status = 'completed' | 'active' | 'upcoming';

interface MilestoneFormData {
  year: string;
  quarter: Quarter;
  label: string;
  targetAmount: string;
  description: string;
  status: Status;
}

interface MilestoneFormModalProps {
  onClose: () => void;
  onSave: (data: {
    year: number;
    quarter: Quarter;
    label: string;
    target_amount: number;
    description: string | null;
    status: Status;
  }) => void;
  initialData?: Partial<MilestoneFormData>;
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const STATUSES: Status[] = ['upcoming', 'active', 'completed'];

export function MilestoneFormModal({ onClose, onSave, initialData }: MilestoneFormModalProps) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<MilestoneFormData>({
    year: initialData?.year ?? currentYear.toString(),
    quarter: initialData?.quarter ?? 'Q1',
    label: initialData?.label ?? '',
    targetAmount: initialData?.targetAmount ?? '',
    description: initialData?.description ?? '',
    status: initialData?.status ?? 'upcoming',
  });
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

  const handleSubmit = () => {
    const yearNum = parseInt(form.year, 10);
    if (!Number.isFinite(yearNum) || yearNum < 2020 || yearNum > 2100) {
      setError('Year must be between 2020 and 2100');
      return;
    }
    if (!form.label.trim()) {
      setError('Label is required');
      return;
    }
    const target = parseFloat(form.targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      setError('Target amount must be a positive number');
      return;
    }

    onSave({
      year: yearNum,
      quarter: form.quarter,
      label: form.label.trim(),
      target_amount: target,
      description: form.description.trim() || null,
      status: form.status,
    });
    onClose();
  };

  const set = <K extends keyof MilestoneFormData>(key: K, val: MilestoneFormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0a0e1a] border border-[#1f2937] rounded-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#1f2937]">
          <h2 className="text-base font-bold text-[#e2e8f0] font-mono">
            {initialData?.label ? 'Edit Milestone' : 'New Milestone'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#151b28] rounded transition-colors" aria-label="Close">
            <X size={18} className="text-[#94a3b8]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#475569] block mb-1.5">Year</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#c084fc]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#475569] block mb-1.5">Quarter</label>
              <div className="grid grid-cols-4 gap-1">
                {QUARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => set('quarter', q)}
                    className={`py-2 text-xs font-bold rounded transition-colors ${
                      form.quarter === q
                        ? 'bg-[#c084fc] text-[#0a0e1a]'
                        : 'bg-[#151b28] border border-[#1f2937] text-[#94a3b8] hover:border-[#c084fc]/30'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Label *</label>
            <input
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="e.g. Q1 Foundation"
              maxLength={80}
              className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#c084fc]/50"
            />
          </div>

          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Target Amount ($) *</label>
            <input
              type="number"
              value={form.targetAmount}
              onChange={(e) => set('targetAmount', e.target.value)}
              placeholder="25000"
              className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#c084fc]/50"
            />
          </div>

          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What needs to happen this quarter..."
              maxLength={500}
              rows={3}
              className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#c084fc]/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-[#475569] block mb-1.5">Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`py-2 text-xs font-bold rounded capitalize transition-colors ${
                    form.status === s
                      ? 'bg-[#c084fc] text-[#0a0e1a]'
                      : 'bg-[#151b28] border border-[#1f2937] text-[#94a3b8] hover:border-[#c084fc]/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-[#1f2937]">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] border border-[#1f2937] hover:border-[#2d3748] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 text-sm font-bold bg-[#c084fc] hover:bg-[#a855f7] text-[#0a0e1a] rounded transition-colors"
          >
            Save Milestone
          </button>
        </div>
      </div>
    </div>
  );
}
