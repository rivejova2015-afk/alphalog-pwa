'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';

interface BotAccount { id: string; label: string; account_id: string; }

type MarketType = 'forex' | 'futures' | 'options';
type Direction  = 'long'  | 'short'  | 'both';

const FOREX_INSTRUMENTS = [
  'XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY',
  'USDCHF','AUDUSD','NZDUSD','USDCAD','GBPJPY','EURJPY','EURGBP',
];

const FUTURES_CONTRACTS = [
  { symbol: 'ES',  name: 'E-mini S&P 500',     tick: '$12.50', margin: '$12,600' },
  { symbol: 'NQ',  name: 'E-mini Nasdaq-100',   tick: '$5.00',  margin: '$18,000' },
  { symbol: 'YM',  name: 'E-mini Dow',          tick: '$5.00',  margin: '$9,000'  },
  { symbol: 'RTY', name: 'E-mini Russell 2000', tick: '$5.00',  margin: '$7,000'  },
  { symbol: 'MES', name: 'Micro E-mini S&P',    tick: '$1.25',  margin: '$1,260'  },
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq', tick: '$0.50',  margin: '$1,800'  },
  { symbol: 'MYM', name: 'Micro E-mini Dow',    tick: '$0.50',  margin: '$900'    },
  { symbol: 'M2K', name: 'Micro E-mini Russell',tick: '$0.50',  margin: '$700'    },
];

const OPTIONS_UNDERLYINGS = [
  'SPX','SPY','QQQ','GLD','/ES','AAPL','TSLA','NVDA','MSFT','AMZN',
];

const OPTIONS_STRATEGIES = [
  { value: 'vertical_spread',   label: 'Vertical Spread',    desc: 'Debit/credit con 2 strikes' },
  { value: 'iron_condor',       label: 'Iron Condor',        desc: 'Vende call spread + put spread OTM' },
  { value: 'straddle',          label: 'Straddle',           desc: 'Compra/vende ATM call + put mismo strike' },
  { value: 'strangle',          label: 'Strangle',           desc: 'OTM call + OTM put diferente strike' },
  { value: 'butterfly',         label: 'Butterfly',          desc: '3 strikes, riesgo definido' },
  { value: 'calendar_spread',   label: 'Calendar Spread',    desc: 'Mismo strike, diferente vencimiento' },
  { value: 'covered_call',      label: 'Covered Call',       desc: 'Largo subyacente + call vendida' },
  { value: 'cash_secured_put',  label: 'Cash-Secured Put',   desc: 'Put vendida cubierta con cash' },
];

const STEPS = ['Básico', 'Overrides'] as const;

// ─── UI primitives ────────────────────────────────────────────────────────────

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

function TextInput({ value, onChange, placeholder = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input type="text" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
  );
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
      {children}
    </select>
  );
}

function DirectionChips({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button key={o.value} type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
            value === o.value
              ? 'border-[#34d399] bg-[#34d399]/10 text-[#34d399]'
              : 'border-[#1f2937] bg-transparent text-[#475569] hover:border-[#2d3748]'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Step 1: Forex ────────────────────────────────────────────────────────────

function StepForex({ name, setName, legA, setLegA, legB, setLegB,
  direction, setDirection, botAccountId, setBotAccountId, botAccounts }: {
  name: string; setName: (v: string) => void;
  legA: string; setLegA: (v: string) => void;
  legB: string; setLegB: (v: string) => void;
  direction: Direction; setDirection: (v: Direction) => void;
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
          <Select value={legA} onChange={setLegA}>
            {FOREX_INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Leg B — instrumento corto">
          <Select value={legB} onChange={setLegB}>
            {FOREX_INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Dirección de Leg A">
        <DirectionChips value={direction} onChange={(v) => setDirection(v as Direction)}
          options={[
            { value: 'long',  label: 'Long bias'  },
            { value: 'both',  label: 'Both ✓'     },
            { value: 'short', label: 'Short bias'  },
          ]} />
      </Field>

      <Field label="Cuenta MT4/MT5" hint="El engine conectará esta estrategia con la cuenta seleccionada.">
        {botAccounts.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-xs text-[#2d3748]">
            <Server size={12} />
            Sin cuentas bot — ve a Bot Control para agregar una
          </div>
        ) : (
          <Select value={botAccountId} onChange={setBotAccountId}>
            <option value="">— Sin vincular —</option>
            {botAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label} ({a.account_id})</option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

// ─── Step 1: Futures ──────────────────────────────────────────────────────────

function StepFutures({ name, setName, contract, setContract, direction, setDirection,
  hedgeEnabled, setHedgeEnabled, hedgeContract, setHedgeContract, ibkrAccount, setIbkrAccount }: {
  name: string; setName: (v: string) => void;
  contract: string; setContract: (v: string) => void;
  direction: Direction; setDirection: (v: Direction) => void;
  hedgeEnabled: boolean; setHedgeEnabled: (v: boolean) => void;
  hedgeContract: string; setHedgeContract: (v: string) => void;
  ibkrAccount: string; setIbkrAccount: (v: string) => void;
}) {
  const selected = FUTURES_CONTRACTS.find((c) => c.symbol === contract);

  return (
    <div className="space-y-4">
      <Field label="Nombre de la estrategia *">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="ES Mean Reversion v1" autoFocus
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <Field label="Contrato CME">
        <Select value={contract} onChange={setContract}>
          {FUTURES_CONTRACTS.map((c) => (
            <option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name}</option>
          ))}
        </Select>
        {selected && (
          <div className="mt-1.5 flex gap-3 text-[10px] text-[#475569]">
            <span>Tick: <span className="text-[#22d3ee]">{selected.tick}</span></span>
            <span>Margen: <span className="text-[#22d3ee]">{selected.margin}</span></span>
          </div>
        )}
      </Field>

      <Field label="Dirección">
        <DirectionChips value={direction} onChange={(v) => setDirection(v as Direction)}
          options={[
            { value: 'long',  label: 'Long bias'  },
            { value: 'both',  label: 'Both ✓'     },
            { value: 'short', label: 'Short bias'  },
          ]} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Hedge leg CME (spread)</Label>
          <button type="button" onClick={() => setHedgeEnabled(!hedgeEnabled)}
            className={`relative inline-flex h-4 w-8 rounded-full transition-colors ${hedgeEnabled ? 'bg-[#34d399]' : 'bg-[#1f2937]'}`}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white mt-0.5 transition-transform ${hedgeEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {hedgeEnabled && (
          <Select value={hedgeContract} onChange={setHedgeContract}>
            {FUTURES_CONTRACTS.filter((c) => c.symbol !== contract).map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol} — {c.name}</option>
            ))}
          </Select>
        )}
      </div>

      <Field label="Cuenta IBKR" hint="Formato: U1234567">
        <TextInput value={ibkrAccount} onChange={setIbkrAccount} placeholder="U1234567" />
      </Field>
    </div>
  );
}

// ─── Step 1: Options ──────────────────────────────────────────────────────────

type OptionsDirection = 'bullish' | 'bearish' | 'neutral' | 'both';

function StepOptions({ name, setName, underlying, setUnderlying, strategy, setStrategy,
  direction, setDirection, ibkrAccount, setIbkrAccount }: {
  name: string; setName: (v: string) => void;
  underlying: string; setUnderlying: (v: string) => void;
  strategy: string; setStrategy: (v: string) => void;
  direction: OptionsDirection; setDirection: (v: OptionsDirection) => void;
  ibkrAccount: string; setIbkrAccount: (v: string) => void;
}) {
  const selectedStrat = OPTIONS_STRATEGIES.find((s) => s.value === strategy);

  return (
    <div className="space-y-4">
      <Field label="Nombre de la estrategia *">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="SPX Iron Condor v1" autoFocus
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Subyacente">
          <Select value={underlying} onChange={setUnderlying}>
            {OPTIONS_UNDERLYINGS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Estrategia">
          <Select value={strategy} onChange={setStrategy}>
            {OPTIONS_STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {selectedStrat && (
        <p className="text-[10px] text-[#475569] -mt-1">{selectedStrat.desc}</p>
      )}

      <Field label="Dirección / Bias">
        <DirectionChips value={direction} onChange={(v) => setDirection(v as OptionsDirection)}
          options={[
            { value: 'bullish', label: 'Bullish'  },
            { value: 'neutral', label: 'Neutral ✓'},
            { value: 'bearish', label: 'Bearish'  },
            { value: 'both',    label: 'Both'     },
          ]} />
      </Field>

      <Field label="Cuenta IBKR" hint="Formato: U1234567">
        <TextInput value={ibkrAccount} onChange={setIbkrAccount} placeholder="U1234567" />
      </Field>
    </div>
  );
}

// ─── Step 2: Overrides — Forex ────────────────────────────────────────────────

function StepOverridesForex({ overrides, set }: {
  overrides: Record<string, string>; set: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <InfoBanner text="El engine ejecuta scanner, circuit breakers y señales de forma nativa. Solo ajusta aquí si necesitas cambiar algún límite puntual." />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Límite de ops por día" hint="Engine default: 1,200 ops">
          <NumInput value={overrides.daily_op_limit} onChange={(v) => set('daily_op_limit', v)}
            step="100" min="100" placeholder="1200" />
        </Field>
        <Field label="Pérdida diaria máx. (%)" hint="Engine default: 3%">
          <NumInput value={overrides.max_daily_loss_pct} onChange={(v) => set('max_daily_loss_pct', v)}
            step="0.5" min="0.5" placeholder="3.0" />
        </Field>
        <Field label="Posiciones simultáneas máx." hint="Engine default: 5">
          <NumInput value={overrides.max_concurrent} onChange={(v) => set('max_concurrent', v)}
            step="1" min="1" placeholder="5" />
        </Field>
        <Field label="Lotes por leg" hint="Engine default: 0.01">
          <NumInput value={overrides.lot_per_leg} onChange={(v) => set('lot_per_leg', v)}
            step="0.01" min="0.01" placeholder="0.01" />
        </Field>
      </div>
      <EmptyHint />
    </div>
  );
}

// ─── Step 2: Overrides — Futures ──────────────────────────────────────────────

function StepOverridesFutures({ overrides, set }: {
  overrides: Record<string, string>; set: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <InfoBanner text="Defaults CME optimizados para E-mini. Micro contracts requieren ajustar tick_tolerance y tamaño." />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Contratos por operación" hint="Engine default: 1">
          <NumInput value={overrides.contracts_per_trade} onChange={(v) => set('contracts_per_trade', v)}
            step="1" min="1" placeholder="1" />
        </Field>
        <Field label="Pérdida diaria máx. ($)" hint="Engine default: $500">
          <NumInput value={overrides.max_daily_loss_usd} onChange={(v) => set('max_daily_loss_usd', v)}
            step="100" min="100" placeholder="500" />
        </Field>
        <Field label="Tick tolerance" hint="Ticks adversos antes de salir (default: 4)">
          <NumInput value={overrides.tick_tolerance} onChange={(v) => set('tick_tolerance', v)}
            step="1" min="1" placeholder="4" />
        </Field>
        <Field label="Días antes de rollover" hint="Rotar al siguiente vencimiento (default: 5)">
          <NumInput value={overrides.rollover_days_before} onChange={(v) => set('rollover_days_before', v)}
            step="1" min="1" placeholder="5" />
        </Field>
        <Field label="Límite ops por día" hint="Engine default: 200">
          <NumInput value={overrides.daily_op_limit} onChange={(v) => set('daily_op_limit', v)}
            step="10" min="10" placeholder="200" />
        </Field>
      </div>
      <EmptyHint />
    </div>
  );
}

// ─── Step 2: Overrides — Options ──────────────────────────────────────────────

function StepOverridesOptions({ overrides, set }: {
  overrides: Record<string, string>; set: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <InfoBanner text="Defaults óptimos para opciones IBKR. Delta y DTE controlan la selección de strikes y vencimientos." />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Delta objetivo" hint="Strike selection (default: 0.30)">
          <NumInput value={overrides.target_delta} onChange={(v) => set('target_delta', v)}
            step="0.05" min="0.05" placeholder="0.30" />
        </Field>
        <Field label="IV Rank mínimo (%)" hint="Solo entrar si IV rank ≥ X (default: 30)">
          <NumInput value={overrides.min_iv_rank} onChange={(v) => set('min_iv_rank', v)}
            step="5" min="5" placeholder="30" />
        </Field>
        <Field label="DTE mínimo" hint="Días a vencimiento mínimo (default: 21)">
          <NumInput value={overrides.min_dte} onChange={(v) => set('min_dte', v)}
            step="1" min="1" placeholder="21" />
        </Field>
        <Field label="DTE máximo" hint="Días a vencimiento máximo (default: 45)">
          <NumInput value={overrides.max_dte} onChange={(v) => set('max_dte', v)}
            step="1" min="1" placeholder="45" />
        </Field>
        <Field label="Contratos máx. por posición" hint="Engine default: 5">
          <NumInput value={overrides.max_contracts} onChange={(v) => set('max_contracts', v)}
            step="1" min="1" placeholder="5" />
        </Field>
        <Field label="Prima máx. $ por contrato" hint="Límite de debit/credit (default: $200)">
          <NumInput value={overrides.max_premium_usd} onChange={(v) => set('max_premium_usd', v)}
            step="25" min="25" placeholder="200" />
        </Field>
      </div>
      <EmptyHint />
    </div>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-4 py-3 text-xs text-[#22d3ee]/80">
      {text}
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="text-[10px] text-[#2d3748] text-center">Los campos vacíos usan los defaults del engine.</p>
  );
}

// ─── Market type selector chips ───────────────────────────────────────────────

const MARKET_CHIPS: { value: MarketType; label: string; color: string }[] = [
  { value: 'forex',   label: 'Forex / MT',    color: '#34d399' },
  { value: 'futures', label: 'Futures CME',   color: '#f59e0b' },
  { value: 'options', label: 'Options IBKR',  color: '#a78bfa' },
];

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const FOREX_OVERRIDES_INIT: Record<string, string> = {
  daily_op_limit: '', max_daily_loss_pct: '', max_concurrent: '', lot_per_leg: '',
};
const FUTURES_OVERRIDES_INIT: Record<string, string> = {
  contracts_per_trade: '', max_daily_loss_usd: '', tick_tolerance: '', rollover_days_before: '', daily_op_limit: '',
};
const OPTIONS_OVERRIDES_INIT: Record<string, string> = {
  target_delta: '', min_iv_rank: '', min_dte: '', max_dte: '', max_contracts: '', max_premium_usd: '',
};

export function NewStrategyWizard({ onClose }: { onClose: () => void }) {
  const [stepIdx,     setStepIdx]     = useState(0);
  const [saving,      setSaving]      = useState(false);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const router = useRouter();

  // Common
  const [name,       setName]       = useState('');
  const [marketType, setMarketType] = useState<MarketType>('forex');
  const [direction,  setDirection]  = useState<Direction>('both');

  // Forex-specific
  const [legA,         setLegA]         = useState('XAUUSD');
  const [legB,         setLegB]         = useState('XAGUSD');
  const [botAccountId, setBotAccountId] = useState('');

  // Futures-specific
  const [contract,      setContract]      = useState('ES');
  const [hedgeEnabled,  setHedgeEnabled]  = useState(false);
  const [hedgeContract, setHedgeContract] = useState('NQ');
  const [ibkrAccount,   setIbkrAccount]   = useState('');

  // Options-specific
  const [underlying,       setUnderlying]       = useState('SPX');
  const [optionsStrategy,  setOptionsStrategy]  = useState('iron_condor');
  const [optionsDirection, setOptionsDirection] = useState<OptionsDirection>('neutral');

  // Overrides (per market type)
  const [forexOvr,   setForexOvr]   = useState<Record<string, string>>(FOREX_OVERRIDES_INIT);
  const [futuresOvr, setFuturesOvr] = useState<Record<string, string>>(FUTURES_OVERRIDES_INIT);
  const [optionsOvr, setOptionsOvr] = useState<Record<string, string>>(OPTIONS_OVERRIDES_INIT);

  const setOvr = (market: MarketType) => (k: string, v: string) => {
    if (market === 'forex')   setForexOvr((o)   => ({ ...o, [k]: v }));
    if (market === 'futures') setFuturesOvr((o) => ({ ...o, [k]: v }));
    if (market === 'options') setOptionsOvr((o) => ({ ...o, [k]: v }));
  };

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

      // Build engine overrides — only non-empty values
      const ovr = marketType === 'forex' ? forexOvr : marketType === 'futures' ? futuresOvr : optionsOvr;
      const engineOverrides: Record<string, number> = {};
      Object.entries(ovr).forEach(([k, v]) => { if (v !== '') engineOverrides[k] = Number(v); });

      // Derive instrument (Leg A / contract / underlying)
      const instrument = marketType === 'forex' ? legA : marketType === 'futures' ? contract : underlying;

      // Build parameters JSONB
      const parameters: Record<string, unknown> = { ...engineOverrides };
      if (marketType === 'forex') {
        parameters.leg_a_instrument = legA;
        parameters.leg_b_instrument = legB;
      } else if (marketType === 'futures') {
        parameters.contract        = contract;
        parameters.ibkr_account    = ibkrAccount || null;
        parameters.hedge_enabled   = hedgeEnabled;
        if (hedgeEnabled) parameters.hedge_contract = hedgeContract;
      } else {
        parameters.underlying        = underlying;
        parameters.options_strategy  = optionsStrategy;
        parameters.ibkr_account      = ibkrAccount || null;
        parameters.options_direction = optionsDirection;
      }

      // Normalize direction for DB (options uses 4 values, DB only stores 3 — map neutral/bearish/bullish to both/short/long)
      const dbDirection: Direction =
        marketType === 'options'
          ? optionsDirection === 'bullish' ? 'long' : optionsDirection === 'bearish' ? 'short' : 'both'
          : direction;

      const { error } = await supabase.from('algorithms').insert({
        user_id:               user.id,
        name:                  name.trim(),
        instrument,
        market_type:           marketType,
        direction:             dbDirection,
        linked_bot_account_id: marketType === 'forex' ? (botAccountId || null) : null,
        lot_size:              engineOverrides.lot_per_leg       ?? 0.01,
        max_trades:            engineOverrides.max_concurrent    ?? 5,
        risk_percent:          engineOverrides.max_daily_loss_pct ?? 3.0,
        parameters,
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
      <div className="w-full max-w-md rounded-2xl border border-[#1f2937] bg-[#0d1117] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937] flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-[#e2e8f0] font-mono">Nueva estrategia</h2>
            <p className="text-[10px] text-[#475569] mt-0.5">Paso {stepIdx + 1} de {STEPS.length} — {STEPS[stepIdx]}</p>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1f2937] flex-shrink-0">
          <div className="h-full bg-[#34d399] transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Market type selector — always visible on Step 1 */}
          {stepIdx === 0 && (
            <div className="flex gap-2 mb-5">
              {MARKET_CHIPS.map((chip) => (
                <button key={chip.value} type="button"
                  onClick={() => setMarketType(chip.value)}
                  className="flex-1 py-2 rounded-lg border text-xs font-bold font-mono transition-all"
                  style={marketType === chip.value ? {
                    borderColor: chip.color,
                    color: chip.color,
                    background: `${chip.color}15`,
                  } : {
                    borderColor: '#1f2937',
                    color: '#475569',
                  }}>
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Step 1 */}
          {stepIdx === 0 && marketType === 'forex' && (
            <StepForex
              name={name} setName={setName}
              legA={legA} setLegA={setLegA}
              legB={legB} setLegB={setLegB}
              direction={direction} setDirection={setDirection}
              botAccountId={botAccountId} setBotAccountId={setBotAccountId}
              botAccounts={botAccounts}
            />
          )}
          {stepIdx === 0 && marketType === 'futures' && (
            <StepFutures
              name={name} setName={setName}
              contract={contract} setContract={setContract}
              direction={direction} setDirection={setDirection}
              hedgeEnabled={hedgeEnabled} setHedgeEnabled={setHedgeEnabled}
              hedgeContract={hedgeContract} setHedgeContract={setHedgeContract}
              ibkrAccount={ibkrAccount} setIbkrAccount={setIbkrAccount}
            />
          )}
          {stepIdx === 0 && marketType === 'options' && (
            <StepOptions
              name={name} setName={setName}
              underlying={underlying} setUnderlying={setUnderlying}
              strategy={optionsStrategy} setStrategy={setOptionsStrategy}
              direction={optionsDirection} setDirection={setOptionsDirection}
              ibkrAccount={ibkrAccount} setIbkrAccount={setIbkrAccount}
            />
          )}

          {/* Step 2 — overrides differ by market */}
          {stepIdx === 1 && marketType === 'forex' && (
            <StepOverridesForex overrides={forexOvr} set={setOvr('forex')} />
          )}
          {stepIdx === 1 && marketType === 'futures' && (
            <StepOverridesFutures overrides={futuresOvr} set={setOvr('futures')} />
          )}
          {stepIdx === 1 && marketType === 'options' && (
            <StepOverridesOptions overrides={optionsOvr} set={setOvr('options')} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#1f2937] flex-shrink-0">
          <button
            onClick={isFirst ? onClose : () => setStepIdx((i) => i - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm hover:border-[#475569] transition-all">
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
