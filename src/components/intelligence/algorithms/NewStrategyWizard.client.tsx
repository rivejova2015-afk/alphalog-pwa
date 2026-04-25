'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Server, Zap, Shield, Radio, Cpu, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotAccount { id: string; label: string; account_id: string; }

const INSTRUMENTS = [
  'XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY',
  'USDCHF','AUDUSD','NZDUSD','USDCAD','GBPJPY','EURJPY','EURGBP',
  'US30','NAS100','SPX500','GER40','OIL','BTCUSD',
];

const TIMEFRAMES = ['M1','M5','M15','M30','H1','H4','D1'] as const;
const SESSIONS   = ['asian','london','new_york','overlap','sydney'] as const;
const REGIMES    = ['SIDEWAYS_LOW_VOL','SIDEWAYS_HIGH_VOL','BULL_TREND_WEAK','BEAR_TREND_WEAK','BREAKOUT_IMMINENT'] as const;

const STEPS = [
  { id: 'basic',    label: 'Básico',        icon: Cpu   },
  { id: 'signal',   label: 'Señal',         icon: Zap   },
  { id: 'sizing',   label: 'Sizing',        icon: Shield },
  { id: 'breakers', label: 'Circuit Breakers', icon: Shield },
  { id: 'scanner',  label: 'Scanner',       icon: Radio },
  { id: 'review',   label: 'Revisión',      icon: Eye   },
] as const;

type StepId = typeof STEPS[number]['id'];

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_PARAMS = {
  // Entry
  zscore_entry:        2.0,
  min_edge_pips:       1.5,
  min_correlation:     0.85,
  lookback_bars:       100,
  half_life_max_min:   4,
  // Exit
  zscore_exit:         0.3,
  zscore_stop:         3.5,
  max_hold_seconds:    180,
  partial_exit_pct:    50,
  // Sizing
  lot_per_leg:         0.01,
  hedge_ratio:         0.87,
  max_slippage_pips:   1.0,
  commission_per_lot:  7.0,
  kelly_fraction:      0.25,
  // Circuit breakers
  max_daily_loss_pct:  3.0,
  max_concurrent:      5,
  cooldown_seconds:    30,
  daily_op_limit:      1200,
  min_sharpe_live:     0.5,
  // Execution
  latency_budget_ms:   500,
  order_type:          'MARKET' as 'MARKET' | 'LIMIT',
};

const DEFAULT_SCAN: ScanConfig = {
  timeframes:        ['M1','M5','M15'],
  primary_tf:        'M5',
  news_enabled:      true,
  news_block_before: 30,
  news_block_after:  15,
  news_impact:       'HIGH',
  sessions: {
    asian:    false,
    london:   true,
    new_york: true,
    overlap:  true,
    sydney:   false,
  },
  volatility: {
    enabled:    true,
    min_atr:    3,
    max_atr:    50,
    atr_period: 14,
    atr_tf:     'M5',
  },
  regime: {
    enabled:  true,
    allowed:  ['SIDEWAYS_LOW_VOL','SIDEWAYS_HIGH_VOL'],
  },
  spread_scanner: {
    enabled:            true,
    scan_interval_ms:   100,
    cointegration_test: true,
    coint_pvalue:       0.05,
  },
};

interface ScanConfig {
  timeframes:        string[];
  primary_tf:        string;
  news_enabled:      boolean;
  news_block_before: number;
  news_block_after:  number;
  news_impact:       'HIGH' | 'MEDIUM' | 'LOW';
  sessions:          Record<string, boolean>;
  volatility: {
    enabled: boolean; min_atr: number; max_atr: number;
    atr_period: number; atr_tf: string;
  };
  regime: { enabled: boolean; allowed: string[] };
  spread_scanner: {
    enabled: boolean; scan_interval_ms: number;
    cointegration_test: boolean; coint_pvalue: number;
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-[#475569] uppercase tracking-wider block mb-1">{children}</label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

function NumInput({ value, onChange, step = 'any', min = '0' }: {
  value: number; onChange: (v: number) => void; step?: string; min?: string;
}) {
  return (
    <input type="number" value={value} step={step} min={min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569]" />
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-[#34d399]' : 'bg-[#1f2937]'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
      {label && <span className="ml-11 text-xs text-[#94a3b8] whitespace-nowrap">{label}</span>}
    </button>
  );
}

function ChipGroup({ options, selected, onChange }: {
  options: readonly string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            selected.includes(o)
              ? 'bg-[#34d399]/15 border-[#34d399]/50 text-[#34d399]'
              : 'border-[#1f2937] text-[#475569] hover:border-[#2d3748] hover:text-[#94a3b8]'
          }`}>{o}</button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-[#34d399] uppercase tracking-widest border-b border-[#1f2937] pb-1">{title}</p>
      {children}
    </div>
  );
}

// ─── Step renderers ───────────────────────────────────────────────────────────

function StepBasic({ form, set, botAccounts }: {
  form: typeof DEFAULT_PARAMS & { name: string; leg_a: string; leg_b: string; linked_bot: string };
  set: (k: string, v: unknown) => void;
  botAccounts: BotAccount[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Nombre *">
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
          placeholder="Gold Arb v1" autoFocus
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Leg A — Instrumento largo">
          <select value={form.leg_a} onChange={(e) => set('leg_a', e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
            {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Leg B — Instrumento corto">
          <select value={form.leg_b} onChange={(e) => set('leg_b', e.target.value)}
            className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
            {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Cuenta vinculada (MT4 / MT5)">
        {botAccounts.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#151b28] border border-[#1f2937] text-xs text-[#2d3748]">
            <Server size={12} /> Sin cuentas bot — configura en Bot Control
          </div>
        ) : (
          <select value={form.linked_bot} onChange={(e) => set('linked_bot', e.target.value)}
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

function StepSignal({ p, setP }: { p: typeof DEFAULT_PARAMS; setP: (k: string, v: number) => void }) {
  return (
    <div className="space-y-4">
      <Section title="① Entrada">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Z-Score entrada (σ)">
            <NumInput value={p.zscore_entry} onChange={(v) => setP('zscore_entry', v)} step="0.1" />
          </Field>
          <Field label="Edge mínimo neto (pips)">
            <NumInput value={p.min_edge_pips} onChange={(v) => setP('min_edge_pips', v)} step="0.1" />
          </Field>
          <Field label="Correlación mínima">
            <NumInput value={p.min_correlation} onChange={(v) => setP('min_correlation', v)} step="0.01" />
          </Field>
          <Field label="Lookback bars">
            <NumInput value={p.lookback_bars} onChange={(v) => setP('lookback_bars', v)} step="10" min="20" />
          </Field>
          <Field label="Half-life máx. reversión (min)">
            <NumInput value={p.half_life_max_min} onChange={(v) => setP('half_life_max_min', v)} step="1" min="1" />
          </Field>
        </div>
      </Section>

      <Section title="② Salida">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Z-Score objetivo salida (σ)">
            <NumInput value={p.zscore_exit} onChange={(v) => setP('zscore_exit', v)} step="0.1" />
          </Field>
          <Field label="Z-Score stop (σ)">
            <NumInput value={p.zscore_stop} onChange={(v) => setP('zscore_stop', v)} step="0.1" />
          </Field>
          <Field label="Tiempo máximo posición (seg)">
            <NumInput value={p.max_hold_seconds} onChange={(v) => setP('max_hold_seconds', v)} step="30" min="30" />
          </Field>
          <Field label="Salida parcial en 50% target (%)">
            <NumInput value={p.partial_exit_pct} onChange={(v) => setP('partial_exit_pct', v)} step="5" />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function StepSizing({ p, setP }: { p: typeof DEFAULT_PARAMS; setP: (k: string, v: number | string) => void }) {
  return (
    <div className="space-y-4">
      <Section title="③ Position Sizing">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lotes por leg">
            <NumInput value={p.lot_per_leg} onChange={(v) => setP('lot_per_leg', v)} step="0.01" />
          </Field>
          <Field label="Hedge ratio (β)">
            <NumInput value={p.hedge_ratio} onChange={(v) => setP('hedge_ratio', v)} step="0.01" />
          </Field>
          <Field label="Slippage máx. por leg (pips)">
            <NumInput value={p.max_slippage_pips} onChange={(v) => setP('max_slippage_pips', v)} step="0.1" />
          </Field>
          <Field label="Comisión por lote ($)">
            <NumInput value={p.commission_per_lot} onChange={(v) => setP('commission_per_lot', v)} step="0.5" />
          </Field>
          <Field label="Fracción Kelly (0.25 = quarter)">
            <NumInput value={p.kelly_fraction} onChange={(v) => setP('kelly_fraction', v)} step="0.05" />
          </Field>
        </div>
      </Section>

      <Section title="⑤ Ejecución">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Presupuesto latencia (ms)">
            <NumInput value={p.latency_budget_ms} onChange={(v) => setP('latency_budget_ms', v)} step="50" min="100" />
          </Field>
          <Field label="Tipo de orden">
            <select value={p.order_type}
              onChange={(e) => setP('order_type', e.target.value as 'MARKET' | 'LIMIT')}
              className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
              <option value="MARKET">MARKET — máxima velocidad</option>
              <option value="LIMIT">LIMIT — mejor precio (riesgo no-fill)</option>
            </select>
          </Field>
        </div>
      </Section>
    </div>
  );
}

function StepBreakers({ p, setP }: { p: typeof DEFAULT_PARAMS; setP: (k: string, v: number) => void }) {
  return (
    <Section title="④ Circuit Breakers">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pérdida diaria máx. (%)">
          <NumInput value={p.max_daily_loss_pct} onChange={(v) => setP('max_daily_loss_pct', v)} step="0.5" />
        </Field>
        <Field label="Posiciones simultáneas máx.">
          <NumInput value={p.max_concurrent} onChange={(v) => setP('max_concurrent', v)} step="1" min="1" />
        </Field>
        <Field label="Cooldown entre trades (seg)">
          <NumInput value={p.cooldown_seconds} onChange={(v) => setP('cooldown_seconds', v)} step="5" />
        </Field>
        <Field label="Límite operaciones/día">
          <NumInput value={p.daily_op_limit} onChange={(v) => setP('daily_op_limit', v)} step="100" min="100" />
        </Field>
        <Field label="Sharpe mínimo en vivo">
          <NumInput value={p.min_sharpe_live} onChange={(v) => setP('min_sharpe_live', v)} step="0.1" />
        </Field>
      </div>
      <div className="rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/5 p-3 text-xs text-[#ef4444]/80 mt-2">
        Si el algo supera la pérdida diaria o cae bajo el Sharpe mínimo, se auto-pausa hasta la próxima sesión.
      </div>
    </Section>
  );
}

function StepScanner({ scan, setScan }: { scan: ScanConfig; setScan: (k: keyof ScanConfig, v: unknown) => void }) {
  const setVolatility = (k: string, v: unknown) => setScan('volatility', { ...scan.volatility, [k]: v });
  const setRegime     = (k: string, v: unknown) => setScan('regime',     { ...scan.regime,     [k]: v });
  const setSpread     = (k: string, v: unknown) => setScan('spread_scanner', { ...scan.spread_scanner, [k]: v });
  const setSessions   = (k: string, v: boolean) => setScan('sessions',   { ...scan.sessions,   [k]: v });

  return (
    <div className="space-y-4">
      <Section title="Timeframes de análisis">
        <Field label="Timeframes a escanear (multi-selección)">
          <ChipGroup options={TIMEFRAMES} selected={scan.timeframes}
            onChange={(v) => setScan('timeframes', v)} />
        </Field>
        <Field label="Timeframe principal (señal)">
          <div className="flex gap-1.5 flex-wrap">
            {TIMEFRAMES.map((tf) => (
              <button key={tf} type="button" onClick={() => setScan('primary_tf', tf)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                  scan.primary_tf === tf
                    ? 'bg-[#22d3ee]/15 border-[#22d3ee]/50 text-[#22d3ee]'
                    : 'border-[#1f2937] text-[#475569] hover:border-[#2d3748]'
                }`}>{tf}</button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Filtro de noticias">
        <div className="flex items-center gap-3">
          <Toggle value={scan.news_enabled} onChange={(v) => setScan('news_enabled', v)} />
          <span className="text-xs text-[#94a3b8]">Bloquear trades cerca de noticias de alto impacto</span>
        </div>
        {scan.news_enabled && (
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Field label="Bloquear antes (min)">
              <NumInput value={scan.news_block_before} onChange={(v) => setScan('news_block_before', v)} step="5" />
            </Field>
            <Field label="Bloquear después (min)">
              <NumInput value={scan.news_block_after} onChange={(v) => setScan('news_block_after', v)} step="5" />
            </Field>
            <Field label="Impacto mínimo">
              <select value={scan.news_impact} onChange={(e) => setScan('news_impact', e.target.value)}
                className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-2 focus:outline-none">
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM+</option>
                <option value="LOW">ALL</option>
              </select>
            </Field>
          </div>
        )}
      </Section>

      <Section title="Sesiones de mercado">
        <div className="grid grid-cols-2 gap-2">
          {SESSIONS.map((s) => (
            <div key={s} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0a0e1a] border border-[#1f2937]">
              <span className="text-xs text-[#94a3b8] capitalize">{s.replace('_', ' ')}</span>
              <Toggle value={!!scan.sessions[s]} onChange={(v) => setSessions(s, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Filtro de volatilidad (ATR)">
        <div className="flex items-center gap-3 mb-2">
          <Toggle value={scan.volatility.enabled} onChange={(v) => setVolatility('enabled', v)} />
          <span className="text-xs text-[#94a3b8]">Solo operar si ATR está en rango definido</span>
        </div>
        {scan.volatility.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="ATR mínimo (pips)">
              <NumInput value={scan.volatility.min_atr} onChange={(v) => setVolatility('min_atr', v)} step="1" />
            </Field>
            <Field label="ATR máximo (pips)">
              <NumInput value={scan.volatility.max_atr} onChange={(v) => setVolatility('max_atr', v)} step="1" />
            </Field>
            <Field label="Período ATR">
              <NumInput value={scan.volatility.atr_period} onChange={(v) => setVolatility('atr_period', v)} step="1" min="5" />
            </Field>
            <Field label="TF del ATR">
              <select value={scan.volatility.atr_tf} onChange={(e) => setVolatility('atr_tf', e.target.value)}
                className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-2 focus:outline-none">
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </Field>
          </div>
        )}
      </Section>

      <Section title="Filtro de régimen de mercado">
        <div className="flex items-center gap-3 mb-2">
          <Toggle value={scan.regime.enabled} onChange={(v) => setRegime('enabled', v)} />
          <span className="text-xs text-[#94a3b8]">Solo operar en regímenes favorables para arb</span>
        </div>
        {scan.regime.enabled && (
          <Field label="Regímenes permitidos">
            <ChipGroup options={REGIMES} selected={scan.regime.allowed}
              onChange={(v) => setRegime('allowed', v)} />
          </Field>
        )}
      </Section>

      <Section title="Spread Scanner">
        <div className="flex items-center gap-3 mb-2">
          <Toggle value={scan.spread_scanner.enabled} onChange={(v) => setSpread('enabled', v)} />
          <span className="text-xs text-[#94a3b8]">Monitoreo continuo del spread entre legs</span>
        </div>
        {scan.spread_scanner.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Intervalo de scan (ms)">
              <NumInput value={scan.spread_scanner.scan_interval_ms} onChange={(v) => setSpread('scan_interval_ms', v)} step="50" min="50" />
            </Field>
            <Field label="P-value cointegración">
              <NumInput value={scan.spread_scanner.coint_pvalue} onChange={(v) => setSpread('coint_pvalue', v)} step="0.01" />
            </Field>
            <div className="col-span-2 flex items-center gap-3">
              <Toggle value={scan.spread_scanner.cointegration_test}
                onChange={(v) => setSpread('cointegration_test', v)} />
              <span className="text-xs text-[#94a3b8]">Test de cointegración Engle-Granger antes de entrar</span>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function StepReview({ form, params, scan }: {
  form: { name: string; leg_a: string; leg_b: string };
  params: typeof DEFAULT_PARAMS;
  scan: ScanConfig;
}) {
  const row = (label: string, value: string | number) => (
    <div key={label} className="flex justify-between text-xs py-1 border-b border-[#1f2937]/50">
      <span className="text-[#475569]">{label}</span>
      <span className="text-[#e2e8f0] font-mono">{String(value)}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      <Section title="Estrategia">
        {row('Nombre', form.name)}
        {row('Par arb', `${form.leg_a} / ${form.leg_b}`)}
        {row('Tipo de orden', params.order_type)}
        {row('Latencia máx.', `${params.latency_budget_ms}ms`)}
      </Section>
      <Section title="Señal de entrada / salida">
        {row('Z-Score entrada', `${params.zscore_entry}σ`)}
        {row('Z-Score salida', `${params.zscore_exit}σ`)}
        {row('Z-Score stop', `${params.zscore_stop}σ`)}
        {row('Tiempo máx.', `${params.max_hold_seconds}s`)}
        {row('Correlación mín.', params.min_correlation)}
        {row('Half-life máx.', `${params.half_life_max_min}min`)}
      </Section>
      <Section title="Risk & Circuit Breakers">
        {row('Pérdida diaria máx.', `${params.max_daily_loss_pct}%`)}
        {row('Posiciones simultáneas', params.max_concurrent)}
        {row('Ops/día límite', params.daily_op_limit)}
        {row('Kelly fraction', params.kelly_fraction)}
        {row('Sharpe mínimo', params.min_sharpe_live)}
      </Section>
      <Section title="Scanner">
        {row('Timeframes', scan.timeframes.join(', '))}
        {row('TF principal', scan.primary_tf)}
        {row('Filtro noticias', scan.news_enabled ? `${scan.news_block_before}min antes / ${scan.news_block_after}min después` : 'OFF')}
        {row('Sesiones activas', Object.entries(scan.sessions).filter(([,v]) => v).map(([k]) => k).join(', '))}
        {row('Filtro volatilidad', scan.volatility.enabled ? `ATR ${scan.volatility.min_atr}–${scan.volatility.max_atr} pips` : 'OFF')}
        {row('Filtro régimen', scan.regime.enabled ? scan.regime.allowed.length + ' regímenes' : 'OFF')}
        {row('Spread scanner', scan.spread_scanner.enabled ? `${scan.spread_scanner.scan_interval_ms}ms` : 'OFF')}
      </Section>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function NewStrategyWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep]     = useState<StepId>('basic');
  const [saving, setSaving] = useState(false);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const router = useRouter();

  const [basic, setBasicState] = useState({ name: '', leg_a: 'XAUUSD', leg_b: 'XAGUSD', linked_bot: '' });
  const [params, setParamsState] = useState<typeof DEFAULT_PARAMS>({ ...DEFAULT_PARAMS });
  const [scan,   setScanState]   = useState<ScanConfig>({ ...DEFAULT_SCAN });

  const setBasic  = (k: string, v: unknown) => setBasicState((f) => ({ ...f, [k]: v }));
  const setParam  = (k: string, v: unknown) => setParamsState((f) => ({ ...f, [k]: v }));
  const setScan   = (k: keyof ScanConfig, v: unknown) => setScanState((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const supabase = createClient();
    supabase.from('bot_accounts').select('id, label, account_id')
      .then(({ data }) => setBotAccounts(data ?? []));
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isFirst   = stepIndex === 0;
  const isLast    = stepIndex === STEPS.length - 1;

  async function handleCreate() {
    if (!basic.name.trim()) { toast.error('El nombre es obligatorio'); setStep('basic'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('No autenticado'); return; }

      const fullParams = {
        ...params,
        leg_a_instrument: basic.leg_a,
        leg_b_instrument: basic.leg_b,
      };

      const { error } = await supabase.from('algorithms').insert({
        user_id:               user.id,
        name:                  basic.name.trim(),
        instrument:            basic.leg_a,
        linked_bot_account_id: basic.linked_bot || null,
        lot_size:              params.lot_per_leg,
        max_trades:            params.max_concurrent,
        risk_percent:          params.max_daily_loss_pct,
        parameters:            fullParams,
        scan_config:           scan,
        status:                'stopped',
      });

      if (error) { toast.error(error.message); return; }
      toast.success(`Estrategia "${basic.name.trim()}" creada con scanner activo`);
      onClose();
      router.refresh();
    } finally { setSaving(false); }
  }

  const currentForm = { ...basic, ...params };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl rounded-2xl border border-[#1f2937] bg-[#0d1117] shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937] flex-shrink-0">
          <h2 className="text-sm font-bold text-[#e2e8f0] font-mono">New Arbitrage Strategy</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors"><X size={16} /></button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-[#1f2937] flex-shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done   = i < stepIndex;
            return (
              <button key={s.id} onClick={() => setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  active ? 'border-[#34d399] text-[#34d399]' :
                  done   ? 'border-transparent text-[#475569] hover:text-[#94a3b8]' :
                           'border-transparent text-[#2d3748] hover:text-[#475569]'
                }`}>
                {done ? <Check size={12} className="text-[#34d399]" /> : <Icon size={12} />}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {step === 'basic'    && <StepBasic    form={currentForm} set={setBasic}  botAccounts={botAccounts} />}
          {step === 'signal'   && <StepSignal   p={params} setP={setParam} />}
          {step === 'sizing'   && <StepSizing   p={params} setP={setParam} />}
          {step === 'breakers' && <StepBreakers p={params} setP={setParam} />}
          {step === 'scanner'  && <StepScanner  scan={scan} setScan={setScan} />}
          {step === 'review'   && <StepReview   form={basic} params={params} scan={scan} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#1f2937] flex-shrink-0">
          <button onClick={isFirst ? onClose : () => setStep(STEPS[stepIndex - 1].id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1f2937] text-[#94a3b8] text-sm hover:border-[#475569] transition-all">
            <ChevronLeft size={14} /> {isFirst ? 'Cancelar' : 'Anterior'}
          </button>

          <span className="text-xs text-[#2d3748] font-mono">{stepIndex + 1} / {STEPS.length}</span>

          {isLast ? (
            <button onClick={handleCreate} disabled={saving || !basic.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold transition-all disabled:opacity-50">
              {saving ? 'Creando...' : <><Check size={14} /> Crear estrategia</>}
            </button>
          ) : (
            <button onClick={() => setStep(STEPS[stepIndex + 1].id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1f2937] hover:bg-[#2d3748] text-[#e2e8f0] text-sm font-medium transition-all">
              Siguiente <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
