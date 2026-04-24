'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';

const INSTRUMENTS = [
  'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY',
  'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'GBPJPY',
  'EURJPY', 'EURGBP',
];

const MARKET_TYPES = [
  { value: 'forex',   label: 'Forex / MetaTrader (MT4 / MT5)' },
  { value: 'futures', label: 'Futuros' },
  { value: 'options', label: 'Opciones' },
] as const;
type MarketType = typeof MARKET_TYPES[number]['value'];

interface BotAccount { id: string; label: string; account_id: string; }

const INITIAL_FORM = {
  name:             '',
  market_type:      'forex' as MarketType,
  instrument:       'XAUUSD',
  linked_bot_account_id: '',
  lot_size:         '0.10',
  risk_percent:     '1.0',
  stop_loss_pips:   '20',
  take_profit_pips: '40',
  max_trades:       '5',
};

export function NewStrategyButton() {
  const [open, setOpen]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(INITIAL_FORM);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const router = useRouter();

  // Load bot accounts once when modal opens
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from('bot_accounts')
      .select('id, label, account_id')
      .then(({ data }) => setBotAccounts(data ?? []));
  }, [open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleClose() {
    setOpen(false);
    setForm(INITIAL_FORM);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('No autenticado'); return; }

      const { error } = await supabase.from('algorithms').insert({
        user_id:               user.id,
        name:                  form.name.trim(),
        instrument:            form.instrument,
        lot_size:              Number(form.lot_size),
        risk_percent:          Number(form.risk_percent),
        stop_loss_pips:        Number(form.stop_loss_pips),
        take_profit_pips:      Number(form.take_profit_pips),
        max_trades:            Number(form.max_trades),
        status:                'stopped',
        linked_bot_account_id: form.linked_bot_account_id || null,
      });

      if (error) { toast.error(error.message); return; }
      toast.success(`Estrategia "${form.name.trim()}" creada`);
      handleClose();
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
      >
        <Plus size={16} />
        New Strategy
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Nueva estrategia"
        >
          <div className="w-full max-w-md rounded-xl border border-[#1f2937] bg-[#0a0e1a] shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937] flex-shrink-0">
              <h2 className="text-sm font-bold text-[#e2e8f0] font-mono">New Strategy</h2>
              <button onClick={handleClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="GoldScalper v1"
                  autoFocus
                  className="w-full rounded-lg bg-[#151b28] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]"
                />
              </div>

              {/* Market type */}
              <div>
                <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">Tipo de mercado</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {MARKET_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('market_type', value)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all text-center ${
                        form.market_type === value
                          ? 'border-[#34d399]/60 bg-[#34d399]/10 text-[#34d399]'
                          : 'border-[#1f2937] text-[#475569] hover:border-[#2d3748] hover:text-[#94a3b8]'
                      }`}
                    >
                      {value === 'forex' ? 'Forex / MT' : value === 'futures' ? 'Futuros' : 'Opciones'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instrument */}
              <div>
                <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">Instrument</label>
                <select
                  value={form.instrument}
                  onChange={(e) => set('instrument', e.target.value)}
                  className="w-full rounded-lg bg-[#151b28] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none"
                >
                  {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Linked bot account */}
              <div>
                <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">
                  Cuenta vinculada (MT4 / MT5)
                </label>
                {botAccounts.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#151b28] border border-[#1f2937] text-xs text-[#2d3748]">
                    <Server size={12} />
                    Sin cuentas bot — ve a Bot Control para agregar una
                  </div>
                ) : (
                  <select
                    value={form.linked_bot_account_id}
                    onChange={(e) => set('linked_bot_account_id', e.target.value)}
                    className="w-full rounded-lg bg-[#151b28] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none"
                  >
                    <option value="">— Sin vincular —</option>
                    {botAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.label} ({acc.account_id})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-[#2d3748] mt-1">
                  Vincula la cuenta MT4/MT5 que ejecutará esta estrategia. Puedes cambiarlo después.
                </p>
              </div>

              {/* Numeric params */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'lot_size',        label: 'Lot Size',           placeholder: '0.10', step: '0.01' },
                  { key: 'risk_percent',     label: 'Risk %',             placeholder: '1.0',  step: '0.1'  },
                  { key: 'stop_loss_pips',   label: 'Stop Loss (pips)',   placeholder: '20',   step: '1'    },
                  { key: 'take_profit_pips', label: 'Take Profit (pips)', placeholder: '40',   step: '1'    },
                ] as const).map(({ key, label, placeholder, step }) => (
                  <div key={key}>
                    <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">{label}</label>
                    <input
                      type="number"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={placeholder}
                      step={step}
                      min="0"
                      className="w-full rounded-lg bg-[#151b28] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569]"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs text-[#475569] uppercase tracking-wide block mb-1">Max Trades</label>
                  <input
                    type="number"
                    value={form.max_trades}
                    onChange={(e) => set('max_trades', e.target.value)}
                    placeholder="5"
                    step="1"
                    min="1"
                    className="w-full rounded-lg bg-[#151b28] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-[#1f2937] flex-shrink-0">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm hover:border-[#475569] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 rounded-lg bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold transition-all disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Strategy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
