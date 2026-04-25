'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';

interface BotAccount { id: string; label: string; account_id: string; }

const INSTRUMENTS = [
  'XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY',
  'USDCHF','AUDUSD','NZDUSD','USDCAD','GBPJPY','EURJPY','EURGBP',
  'US30','NAS100','SPX500','GER40','OIL','BTCUSD',
];

const STEPS = ['Básico', 'Overrides'] as const;

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">{children}</label>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-[#2d3748] mt-1">{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange, step = 'any', min = '0', placeholder = '' }: {
  value: string; onChange: (v: string) => void; step?: string; min?: string; placeholder?: string;
}) {
  return (
    <input type="number" value={value} step={step} min={min} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
  );
}

// ─── Step 1: Básico ───────────────────────────────────────────────────────────

function StepBasic({ name, setName, legA, setLegA, legB, setLegB, botAccountId, setBotAccountId, botAccounts }: {
  name: string; setName: (v: string) => void;
  legA: string; setLegA: (v: string) => void;
  legB: string; setLegB: (v: string) => void;
  botAccountId: string; setBotAccountId: (v: string) => void;
  botAccounts: BotAccount[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Nombre de la estrategia *">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Gold Arb v1" autoFocus
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Leg A — instrumento largo">
          <select value={legA} onChange={(e) => setLegA(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
            {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Leg B — instrumento corto">
          <select value={legB} onChange={(e) => setLegB(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
            {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Cuenta vinculada (MT4 / MT5)"
        hint="El engine conectará esta estrategia con la cuenta seleccionada.">
        {botAccounts.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-xs text-[#2d3748]">
            <Server size={12} />
            Sin cuentas bot configuradas — ve a Bot Control para agregar una
          </div>
        ) : (
          <select value={botAccountId} onChange={(e) => setBotAccountId(e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
            <option value="">— Sin vincular —</option>
            {botAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label} ({a.account_id})</option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}

// ─── Step 2: Overrides ────────────────────────────────────────────────────────

function StepOverrides({ overrides, set }: {
  overrides: Record<string, string>;
  set: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-4 py-3 text-xs text-[#22d3ee]/80">
        El engine ejecuta scanner, circuit breakers y señales de forma nativa con sus defaults óptimos.
        Solo ajusta aquí si necesitas cambiar algún límite puntual para esta estrategia.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Límite de ops por día"
          hint={`Engine default: 1,200 ops`}>
          <NumInput value={overrides.daily_op_limit} onChange={(v) => set('daily_op_limit', v)}
            step="100" min="100" placeholder="1200" />
        </Field>

        <Field label="Pérdida diaria máx. (%)"
          hint="Engine default: 3%">
          <NumInput value={overrides.max_daily_loss_pct} onChange={(v) => set('max_daily_loss_pct', v)}
            step="0.5" min="0.5" placeholder="3.0" />
        </Field>

        <Field label="Posiciones simultáneas máx."
          hint="Engine default: 5">
          <NumInput value={overrides.max_concurrent} onChange={(v) => set('max_concurrent', v)}
            step="1" min="1" placeholder="5" />
        </Field>

        <Field label="Lotes por leg"
          hint="Engine default: 0.01">
          <NumInput value={overrides.lot_per_leg} onChange={(v) => set('lot_per_leg', v)}
            step="0.01" min="0.01" placeholder="0.01" />
        </Field>
      </div>

      <p className="text-[10px] text-[#2d3748] text-center">
        Los campos vacíos usan los defaults del engine.
      </p>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function NewStrategyWizard({ onClose }: { onClose: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const router = useRouter();

  // Step 1 state
  const [name,         setName]         = useState('');
  const [legA,         setLegA]         = useState('XAUUSD');
  const [legB,         setLegB]         = useState('XAGUSD');
  const [botAccountId, setBotAccountId] = useState('');

  // Step 2 state — empty = use engine default
  const [overrides, setOverrides] = useState<Record<string, string>>({
    daily_op_limit:    '',
    max_daily_loss_pct:'',
    max_concurrent:    '',
    lot_per_leg:       '',
  });
  const setOverride = (k: string, v: string) => setOverrides((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    createClient().from('bot_accounts').select('id, label, account_id')
      .then(({ data }) => setBotAccounts(data ?? []));
  }, []);

  const isFirst = stepIdx === 0;
  const isLast  = stepIdx === STEPS.length - 1;

  async function handleCreate() {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); setStepIdx(0); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('No autenticado'); return; }

      // Build overrides object — only include non-empty values
      const engineOverrides: Record<string, number> = {};
      Object.entries(overrides).forEach(([k, v]) => {
        if (v !== '') engineOverrides[k] = Number(v);
      });

      const { error } = await supabase.from('algorithms').insert({
        user_id:               user.id,
        name:                  name.trim(),
        instrument:            legA,
        linked_bot_account_id: botAccountId || null,
        lot_size:              engineOverrides.lot_per_leg      ?? 0.01,
        max_trades:            engineOverrides.max_concurrent   ?? 5,
        risk_percent:          engineOverrides.max_daily_loss_pct ?? 3.0,
        parameters: {
          leg_a_instrument: legA,
          leg_b_instrument: legB,
          ...engineOverrides,
        },
        scan_config: {},
        status: 'stopped',
      });

      if (error) { toast.error(error.message); return; }
      toast.success(`"${name.trim()}" registrada — el engine la activará al conectar`);
      onClose();
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-[#1f2937] bg-[#0d1117] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
          <div>
            <h2 className="text-sm font-bold text-[#e2e8f0] font-mono">Nueva estrategia</h2>
            <p className="text-[10px] text-[#475569] mt-0.5">Paso {stepIdx + 1} de {STEPS.length} — {STEPS[stepIdx]}</p>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1f2937]">
          <div className="h-full bg-[#34d399] transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="p-5">
          {stepIdx === 0 && (
            <StepBasic
              name={name} setName={setName}
              legA={legA} setLegA={setLegA}
              legB={legB} setLegB={setLegB}
              botAccountId={botAccountId} setBotAccountId={setBotAccountId}
              botAccounts={botAccounts}
            />
          )}
          {stepIdx === 1 && (
            <StepOverrides overrides={overrides} set={setOverride} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#1f2937]">
          <button
            onClick={isFirst ? onClose : () => setStepIdx((i) => i - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm hover:border-[#475569] transition-all"
          >
            <ChevronLeft size={14} />
            {isFirst ? 'Cancelar' : 'Anterior'}
          </button>

          {isLast ? (
            <button onClick={handleCreate} disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold transition-all disabled:opacity-50">
              {saving ? 'Creando...' : <><Check size={14} /> Crear estrategia</>}
            </button>
          ) : (
            <button onClick={() => setStepIdx((i) => i + 1)} disabled={!name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1f2937] hover:bg-[#2d3748] text-[#e2e8f0] text-sm font-medium transition-all disabled:opacity-40">
              Siguiente <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
