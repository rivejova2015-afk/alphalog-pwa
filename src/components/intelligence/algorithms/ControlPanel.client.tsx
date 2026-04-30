'use client';

import { useState } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface StrategyParam {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

interface ControlPanelProps {
  algoId: string;
  algoName: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  onStatusChange?: (id: string, newStatus: 'ACTIVE' | 'PAUSED') => void;
}

const DEFAULT_PARAMS: StrategyParam[] = [
  { key: 'lot_size', label: 'Lot Size', value: 0.5, min: 0.01, max: 5.0, step: 0.01 },
  { key: 'stop_loss_pips', label: 'Stop Loss', value: 50, min: 10, max: 200, step: 5, unit: 'pips' },
  { key: 'take_profit_pips', label: 'Take Profit', value: 100, min: 20, max: 500, step: 5, unit: 'pips' },
  { key: 'max_trades', label: 'Max Open Trades', value: 3, min: 1, max: 10, step: 1 },
  { key: 'risk_percent', label: 'Risk Per Trade', value: 2.0, min: 0.5, max: 5.0, step: 0.5, unit: '%' },
];

export function ControlPanel({ algoId, algoName, status, onStatusChange }: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<StrategyParam[]>(DEFAULT_PARAMS);
  const [saved, setSaved] = useState(false);

  const handleParamChange = (key: string, value: number) => {
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, value } : p)));
    setSaved(false);
  };

  const handleSave = async () => {
    const parameters = Object.fromEntries(params.map((p) => [p.key, p.value]));
    try {
      const res = await fetch(`/api/algorithms/${algoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters }),
      });
      if (!res.ok) { toast.error('Error al guardar parámetros'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setSaved(false);
  };

  const toggleStatus = async () => {
    const next = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const dbStatus = next === 'ACTIVE' ? 'running' : 'paused';
    try {
      const res = await fetch(`/api/algorithms/${algoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: dbStatus }),
      });
      if (!res.ok) { toast.error('Error al cambiar estado'); return; }
      onStatusChange?.(algoId, next);
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg">
      {/* Header toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#151b28] transition-colors rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-bold text-[#e2e8f0]">Control Panel — {algoName}</span>
        {isOpen ? <ChevronUp size={16} className="text-[#94a3b8]" /> : <ChevronDown size={16} className="text-[#94a3b8]" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#1f2937] pt-4">
          {/* Status toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void toggleStatus()}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-colors ${
                status === 'ACTIVE'
                  ? 'bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30'
                  : 'bg-[#34d399]/10 hover:bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30'
              }`}
            >
              {status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
              {status === 'ACTIVE' ? 'Pause Strategy' : 'Resume Strategy'}
            </button>
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <p className="text-xs text-[#475569] uppercase tracking-wider font-medium">Strategy Parameters</p>
            {params.map((param) => (
              <div key={param.key}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs text-[#94a3b8]">{param.label}</label>
                  <span className="text-xs font-mono text-[#22d3ee] font-bold">
                    {param.value}{param.unit || ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={param.value}
                  onChange={(e) => handleParamChange(param.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#1f2937] rounded appearance-none cursor-pointer accent-[#22d3ee]"
                />
                <div className="flex justify-between text-[10px] text-[#475569] mt-0.5">
                  <span>{param.min}{param.unit || ''}</span>
                  <span>{param.max}{param.unit || ''}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => void handleSave()}
              className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${
                saved
                  ? 'bg-[#34d399] text-[#0a0e1a]'
                  : 'bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a]'
              }`}
            >
              {saved ? '✓ Saved' : 'Save Parameters'}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#151b28] rounded transition-colors border border-[#1f2937]"
              title="Reset to defaults"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
