'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, ShieldOff, Play, Pause } from 'lucide-react';

interface RiskConfig {
  id: string;
  enabled: boolean;
  circuit_breaker_pct: number;
  max_positions: number | null;
  paused_reason: string | null;
  paused_at: string | null;
}

interface Props {
  cmeAccountId: string;
}

export default function CmeRiskConfigPanel({ cmeAccountId }: Props) {
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cbPct, setCbPct] = useState(80);
  const [maxPos, setMaxPos] = useState<string>('');

  useEffect(() => {
    fetch(`/api/cme/risk-config?cmeAccountId=${cmeAccountId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }) => {
        const cfg = Array.isArray(data) ? data[0] : data;
        setConfig(cfg ?? null);
        if (cfg) {
          setCbPct(cfg.circuit_breaker_pct ?? 80);
          setMaxPos(cfg.max_positions ? String(cfg.max_positions) : '');
        }
      })
      .finally(() => setLoading(false));
  }, [cmeAccountId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/cme/risk-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmeAccountId,
          circuit_breaker_pct: cbPct,
          max_positions: maxPos ? parseInt(maxPos, 10) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? 'Failed to save config');
        return;
      }
      const { data } = await res.json();
      setConfig(data);
      toast.success('Risk config saved');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cme/risk-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmeAccountId,
          enabled: !config.enabled,
          ...(config.enabled ? {} : { paused_reason: null }),
        }),
      });
      if (!res.ok) {
        toast.error('Failed to toggle account');
        return;
      }
      const { data } = await res.json();
      setConfig(data);
      toast.success(data.enabled ? 'Trading enabled' : 'Trading paused');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-32 rounded-lg bg-white/5 animate-pulse" />;
  }

  const paused = !config?.enabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {paused
            ? <ShieldOff className="w-4 h-4 text-rose-400" />
            : <Shield className="w-4 h-4 text-emerald-400" />
          }
          <span className="text-sm font-medium text-white">
            {paused ? 'Trading Paused' : 'Trading Active'}
          </span>
          {config?.paused_reason && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 capitalize">
              {config.paused_reason.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
            paused
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
          }`}
        >
          {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-white/50">Circuit Breaker (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={cbPct}
            onChange={e => setCbPct(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
          />
          <p className="text-xs text-white/30">% of max daily loss</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Max Open Positions</label>
          <input
            type="number"
            min={1}
            value={maxPos}
            onChange={e => setMaxPos(e.target.value)}
            placeholder="Unlimited"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-sky-500/20 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save Risk Config'}
      </button>
    </div>
  );
}
