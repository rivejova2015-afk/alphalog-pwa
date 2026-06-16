'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import type { AlgorithmTemplate } from '@/types/algorithms';
import { AlgorithmWizardStep2 } from './AlgorithmWizardStep2.client';
import { InstrumentMultiSelect } from './InstrumentMultiSelect.client';
import { InfoBanner } from './InfoBanner.client';
import type { EngineConfig } from '@/lib/validations/engine-config';
import { ENGINE_CONFIG_DEFAULT } from '@/lib/validations/engine-config';

export interface BotAccount { id: string; label: string; account_id: string; }

interface CmeAccount {
  id: string;
  account_type: 'propfirm' | 'broker';
  provider_name: string;
  account_number: string;
  label: string | null;
  funded_amount: number | null;
  max_daily_loss: number | null;
  max_trailing_dd: number | null;
}

type MarketType = 'forex' | 'futures' | 'options';
type Direction  = 'long'  | 'short'  | 'both';

// FOREX_INSTRUMENT_GROUPS removed — instruments now come from /api/instruments
// (see InstrumentMultiSelect). FUTURES_CONTRACTS kept locally because it
// carries tick/margin metadata not present in the instruments table.

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

// OPTIONS_UNDERLYINGS removed — instruments now come from /api/instruments.

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

const PROPFIRM_PROVIDERS = [
  'Apex', 'Lucid Trading', 'MyFundedFutures', 'Tradeify',
];
const BROKER_PROVIDERS = [
  'IBKR', 'Rithmic', 'NinjaTrader Brokerage',
  'TradeStation', 'AMP Futures', 'Optimus Futures',
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

function StepForex({ name, setName,
  instruments, setInstruments, instrumentsError,
  direction, setDirection, botAccountId, setBotAccountId, botAccounts,
  showAddAccount, setShowAddAccount,
  newAccNumber, setNewAccNumber,
  newAccLabel, setNewAccLabel,
  newAccPlatform, setNewAccPlatform,
  addingAccount, handleAddAccount,
  templates, selectedTemplateKey, onTemplateChange,
  selectedPlatform, setSelectedPlatform }: {
  name: string; setName: (v: string) => void;
  instruments: string[]; setInstruments: (v: string[]) => void; instrumentsError: string;
  direction: Direction; setDirection: (v: Direction) => void;
  botAccountId: string; setBotAccountId: (v: string) => void;
  botAccounts: BotAccount[];
  showAddAccount: boolean; setShowAddAccount: (v: boolean) => void;
  newAccNumber: string; setNewAccNumber: (v: string) => void;
  newAccLabel: string; setNewAccLabel: (v: string) => void;
  newAccPlatform: 'MT4' | 'MT5'; setNewAccPlatform: (v: 'MT4' | 'MT5') => void;
  addingAccount: boolean; handleAddAccount: () => Promise<void>;
  templates: AlgorithmTemplate[];
  selectedTemplateKey: string;
  onTemplateChange: (key: string) => void;
  selectedPlatform: 'MT4' | 'MT5';
  setSelectedPlatform: (v: 'MT4' | 'MT5') => void;
}) {
  const forexTemplates = templates.filter((t) => t.market_type === 'forex' && t.is_active);
  const selectedTemplate = forexTemplates.find((t) => t.template_key === selectedTemplateKey);

  return (
    <div className="space-y-4">
      <InfoBanner>
        Estrategia de Forex sobre MT4/MT5. El bot pollea cada bar M1 y devuelve BUY/SELL/HOLD;
        el EA en tu terminal ejecuta la orden localmente. No es server-side dispatch.
      </InfoBanner>

      {forexTemplates.length > 0 && (
        <Field label="Plantilla de EA" hint="Elegí un EA preconfigurado o construí desde cero.">
          <Select value={selectedTemplateKey} onChange={onTemplateChange}>
            <option value="">— Desde cero (custom) —</option>
            {forexTemplates.map((t) => {
              const platforms = t.supported_platforms?.length ? t.supported_platforms.join('/') : 'MT5';
              return (
                <option key={t.template_key} value={t.template_key}>{t.name} — {platforms}</option>
              );
            })}
          </Select>
          {selectedTemplate && (
            <div className="mt-1.5 space-y-1">
              {selectedTemplate.supported_platforms?.length ? (
                <div className="flex gap-1">
                  {selectedTemplate.supported_platforms.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 rounded bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[9px] font-semibold text-[#22d3ee]">
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
              {selectedTemplate.description && (
                <p className="text-[10px] text-[#94a3b8] leading-relaxed">{selectedTemplate.description}</p>
              )}
            </div>
          )}
        </Field>
      )}

      <Field label="Plataforma del bot" hint="Las credenciales generadas serán para esta plataforma.">
        <div className="flex gap-2">
          {(['MT5', 'MT4'] as const).map((p) => {
            const allowed = !selectedTemplate?.supported_platforms?.length
              || selectedTemplate.supported_platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                disabled={!allowed}
                onClick={() => setSelectedPlatform(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  selectedPlatform === p
                    ? 'bg-[#06b6d4] border-[#06b6d4] text-black'
                    : allowed
                      ? 'bg-transparent border-[#1f2937] text-[#94a3b8] hover:border-[#475569]'
                      : 'bg-transparent border-[#1f2937] text-[#475569] opacity-40 cursor-not-allowed'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Nombre de la estrategia *" hint="Cómo querés identificar esta estrategia en tu dashboard. No afecta el comportamiento.">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Gold Arb v1" autoFocus
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <Field label="Instrumentos *" hint="Hasta 10 simbolos. El primero se usa como referencia para los campos derivados.">
        <InstrumentMultiSelect value={instruments} onChange={setInstruments} error={instrumentsError} />
      </Field>

      <Field label="Dirección" hint="Long = solo señales BUY. Short = solo SELL. Both = el engine decide por bar.">
        <DirectionChips value={direction} onChange={(v) => setDirection(v as Direction)}
          options={[
            { value: 'long',  label: 'Long bias'  },
            { value: 'both',  label: 'Both ✓'     },
            { value: 'short', label: 'Short bias'  },
          ]} />
      </Field>

      <Field label="Cuenta MT4/MT5 (opcional)" hint="Si no la vinculás ahora, la estrategia queda en modo research y podés hacer backtests con capital ficticio. Vinculá una cuenta después desde el detalle del algoritmo.">
        <Select value={botAccountId} onChange={(v) => { setBotAccountId(v); setShowAddAccount(false); }}>
          <option value="">— Sin vincular (modo research) —</option>
          {botAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.label} ({a.account_id})</option>
          ))}
        </Select>

        {!showAddAccount ? (
          <button type="button" onClick={() => setShowAddAccount(true)}
            className="mt-1.5 flex items-center gap-1 text-xs text-[#06b6d4] hover:text-[#22d3ee] transition-colors">
            <Plus size={12} /> Agregar cuenta nueva
          </button>
        ) : (
          <div className="mt-2 p-3 rounded-lg bg-[#0a0e1a] border border-[#1f2937] space-y-3">
            <div className="flex gap-2">
              {(['MT4', 'MT5'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setNewAccPlatform(p)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    newAccPlatform === p
                      ? 'bg-[#06b6d4] border-[#06b6d4] text-black'
                      : 'bg-transparent border-[#1f2937] text-[#94a3b8] hover:border-[#475569]'
                  }`}>{p}</button>
              ))}
            </div>
            <input type="text" value={newAccNumber} onChange={(e) => setNewAccNumber(e.target.value)}
              placeholder="Número de cuenta (ej. 12345678)"
              className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
            <input type="text" value={newAccLabel} onChange={(e) => setNewAccLabel(e.target.value)}
              placeholder="Nombre (ej. Gold Live Account)"
              className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
            <div className="flex gap-2">
              <button type="button" onClick={handleAddAccount}
                disabled={addingAccount || !newAccNumber.trim()}
                className="flex-1 py-1.5 rounded-lg bg-[#06b6d4] text-black text-xs font-semibold disabled:opacity-40 hover:bg-[#22d3ee] transition-colors">
                {addingAccount ? 'Guardando…' : 'Guardar cuenta'}
              </button>
              <button type="button"
                onClick={() => { setShowAddAccount(false); setNewAccNumber(''); setNewAccLabel(''); }}
                className="px-3 py-1.5 rounded-lg border border-[#1f2937] text-[#475569] text-xs hover:border-[#475569] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Field>
    </div>
  );
}

// ─── Step 1: Futures ──────────────────────────────────────────────────────────

function StepFutures({
  name, setName,
  contract, setContract: _setContract,
  instruments, setInstruments, instrumentsError,
  direction, setDirection,
  hedgeEnabled, setHedgeEnabled,
  hedgeContract, setHedgeContract,
  cmeAccounts, cmeAccountId, setCmeAccountId,
  showAddCmeAccount, setShowAddCmeAccount,
  newCmeType, setNewCmeType,
  newCmeProvider, setNewCmeProvider,
  newCmeNumber, setNewCmeNumber,
  newCmeLabel, setNewCmeLabel,
  newCmeFunded, setNewCmeFunded,
  newCmeMaxLoss, setNewCmeMaxLoss,
  newCmeTrailingDD, setNewCmeTrailingDD,
  addingCmeAccount, handleAddCmeAccount,
}: {
  name: string; setName: (v: string) => void;
  contract: string; setContract: (v: string) => void;
  instruments: string[]; setInstruments: (v: string[]) => void; instrumentsError: string;
  direction: Direction; setDirection: (v: Direction) => void;
  hedgeEnabled: boolean; setHedgeEnabled: (v: boolean) => void;
  hedgeContract: string; setHedgeContract: (v: string) => void;
  cmeAccounts: CmeAccount[];
  cmeAccountId: string; setCmeAccountId: (v: string) => void;
  showAddCmeAccount: boolean; setShowAddCmeAccount: (v: boolean) => void;
  newCmeType: 'propfirm' | 'broker'; setNewCmeType: (v: 'propfirm' | 'broker') => void;
  newCmeProvider: string; setNewCmeProvider: (v: string) => void;
  newCmeNumber: string; setNewCmeNumber: (v: string) => void;
  newCmeLabel: string; setNewCmeLabel: (v: string) => void;
  newCmeFunded: string; setNewCmeFunded: (v: string) => void;
  newCmeMaxLoss: string; setNewCmeMaxLoss: (v: string) => void;
  newCmeTrailingDD: string; setNewCmeTrailingDD: (v: string) => void;
  addingCmeAccount: boolean; handleAddCmeAccount: () => Promise<void>;
}) {
  const selected = FUTURES_CONTRACTS.find((c) => c.symbol === contract);
  const providers = newCmeType === 'propfirm' ? PROPFIRM_PROVIDERS : BROKER_PROVIDERS;

  return (
    <div className="space-y-4">
      <InfoBanner>
        Estrategia de futuros sobre Tradovate. El cron del servidor (cada minuto) evalúa el engine y
        coloca órdenes vía la API de Tradovate. Empieza en modo shadow hasta que confirmes los signals.
      </InfoBanner>

      <Field label="Nombre de la estrategia *" hint="Cómo querés identificar esta estrategia en tu dashboard. No afecta el comportamiento.">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="ES Mean Reversion v1"
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <Field label="Instrumentos *" hint="Hasta 10 simbolos. El primero define el contrato CME principal y los datos de tick/margen.">
        <InstrumentMultiSelect value={instruments} onChange={setInstruments} error={instrumentsError} />
        {selected && (
          <div className="mt-1.5 flex gap-3 text-[10px] text-[#475569]">
            <span>Tick: <span className="text-[#22d3ee]">{selected.tick}</span></span>
            <span>Margen: <span className="text-[#22d3ee]">{selected.margin}</span></span>
          </div>
        )}
      </Field>

      <Field label="Dirección" hint="Long = solo señales BUY. Short = solo SELL. Both = el engine decide por bar.">
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

      {/* CME Account selector */}
      <Field label="Cuenta CME" hint="Selecciona una cuenta propfirm o broker real para vincular esta estrategia.">
        <Select value={cmeAccountId} onChange={(v) => { setCmeAccountId(v); setShowAddCmeAccount(false); }}>
          <option value="">— Sin vincular —</option>
          {cmeAccounts.map((a) => {
            const badge = a.account_type === 'propfirm' ? 'PropFirm' : 'Broker';
            const display = a.label ?? a.account_number;
            return (
              <option key={a.id} value={a.id}>
                [{badge}] {a.provider_name} — {display}
              </option>
            );
          })}
        </Select>

        {/* Account badges below dropdown */}
        {cmeAccountId && (() => {
          const acc = cmeAccounts.find((a) => a.id === cmeAccountId);
          if (!acc) return null;
          const isPropfirm = acc.account_type === 'propfirm';
          return (
            <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded font-medium ${isPropfirm ? 'bg-[#f59e0b]/15 text-[#f59e0b]' : 'bg-[#06b6d4]/15 text-[#06b6d4]'}`}>
                {isPropfirm ? 'PropFirm' : 'Broker'}
              </span>
              <span className="text-[#475569]">{acc.provider_name}</span>
              <span className="text-[#2d3748]">{acc.account_number}</span>
              {isPropfirm && acc.funded_amount && (
                <span className="text-[#475569]">Fondeo: <span className="text-[#34d399]">${acc.funded_amount.toLocaleString()}</span></span>
              )}
              {isPropfirm && acc.max_daily_loss && (
                <span className="text-[#475569]">Pérd. diaria: <span className="text-[#f87171]">${acc.max_daily_loss.toLocaleString()}</span></span>
              )}
            </div>
          );
        })()}

        {!showAddCmeAccount ? (
          <button type="button" onClick={() => setShowAddCmeAccount(true)}
            className="mt-1.5 flex items-center gap-1 text-xs text-[#06b6d4] hover:text-[#22d3ee] transition-colors">
            <Plus size={12} /> Agregar cuenta nueva
          </button>
        ) : (
          <div className="mt-2 p-3 rounded-lg bg-[#0a0e1a] border border-[#1f2937] space-y-3">
            {/* Type chips */}
            <div className="flex gap-2">
              {(['propfirm', 'broker'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => {
                    setNewCmeType(t);
                    setNewCmeProvider(t === 'propfirm' ? PROPFIRM_PROVIDERS[0] : BROKER_PROVIDERS[0]);
                  }}
                  className={`flex-1 py-1 rounded text-xs font-semibold border transition-colors ${
                    newCmeType === t
                      ? t === 'propfirm'
                        ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]'
                        : 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]'
                      : 'bg-transparent border-[#1f2937] text-[#475569] hover:border-[#2d3748]'
                  }`}>
                  {t === 'propfirm' ? 'PropFirm' : 'Broker real'}
                </button>
              ))}
            </div>

            {/* Provider */}
            <div>
              <p className="text-[10px] text-[#475569] mb-1">Proveedor</p>
              <select value={newCmeProvider} onChange={(e) => setNewCmeProvider(e.target.value)}
                className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none">
                {providers.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Account number */}
            <input type="text" value={newCmeNumber} onChange={(e) => setNewCmeNumber(e.target.value)}
              placeholder={newCmeType === 'broker' ? 'Número de cuenta (ej. U1234567)' : 'ID de cuenta propfirm'}
              className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />

            {/* Label */}
            <input type="text" value={newCmeLabel} onChange={(e) => setNewCmeLabel(e.target.value)}
              placeholder="Nombre / etiqueta (opcional)"
              className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />

            {/* PropFirm-only fields */}
            {newCmeType === 'propfirm' && (
              <div className="space-y-2">
                <div className="h-px bg-[#1f2937]" />
                <p className="text-[10px] text-[#f59e0b]">Parámetros de la cuenta fondada</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[#475569] mb-1">Fondeo ($)</p>
                    <input type="number" value={newCmeFunded} onChange={(e) => setNewCmeFunded(e.target.value)}
                      placeholder="150000" min="0" step="1000"
                      className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none placeholder:text-[#2d3748]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#475569] mb-1">Pérd. diaria ($)</p>
                    <input type="number" value={newCmeMaxLoss} onChange={(e) => setNewCmeMaxLoss(e.target.value)}
                      placeholder="1500" min="0" step="100"
                      className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none placeholder:text-[#2d3748]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#475569] mb-1">Trailing DD ($)</p>
                    <input type="number" value={newCmeTrailingDD} onChange={(e) => setNewCmeTrailingDD(e.target.value)}
                      placeholder="3000" min="0" step="100"
                      className="w-full rounded-lg bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1.5 focus:outline-none placeholder:text-[#2d3748]" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={handleAddCmeAccount}
                disabled={addingCmeAccount || !newCmeNumber.trim()}
                className="flex-1 py-1.5 rounded-lg bg-[#06b6d4] text-black text-xs font-semibold disabled:opacity-40 hover:bg-[#22d3ee] transition-colors">
                {addingCmeAccount ? 'Guardando…' : 'Guardar cuenta'}
              </button>
              <button type="button"
                onClick={() => {
                  setShowAddCmeAccount(false);
                  setNewCmeNumber(''); setNewCmeLabel('');
                  setNewCmeFunded(''); setNewCmeMaxLoss(''); setNewCmeTrailingDD('');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#1f2937] text-[#475569] text-xs hover:border-[#475569] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Field>

      {/* Execution platform badge — futures always route through Tradovate */}
      <div className="flex items-center gap-2 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-3 py-2">
        <span className="text-[10px] text-[#475569] uppercase tracking-wider">Plataforma de ejecución</span>
        <span className="text-xs font-bold text-[#f59e0b] font-mono">TRADOVATE</span>
        <span className="text-[10px] text-[#2d3748] ml-auto">Auto-seleccionada por mercado=futures</span>
      </div>
    </div>
  );
}

// ─── Step 1: Options ──────────────────────────────────────────────────────────

type OptionsDirection = 'bullish' | 'bearish' | 'neutral' | 'both';

function StepOptions({ name, setName, underlying: _underlying, setUnderlying: _setUnderlying,
  instruments, setInstruments, instrumentsError,
  strategy, setStrategy,
  direction, setDirection, ibkrAccount, setIbkrAccount }: {
  name: string; setName: (v: string) => void;
  underlying: string; setUnderlying: (v: string) => void;
  instruments: string[]; setInstruments: (v: string[]) => void; instrumentsError: string;
  strategy: string; setStrategy: (v: string) => void;
  direction: OptionsDirection; setDirection: (v: OptionsDirection) => void;
  ibkrAccount: string; setIbkrAccount: (v: string) => void;
}) {
  const selectedStrat = OPTIONS_STRATEGIES.find((s) => s.value === strategy);

  return (
    <div className="space-y-4">
      <InfoBanner tone="amber">
        Estrategias de opciones vía IBKR. La ejecución real está en desarrollo — por ahora el engine
        evalúa y los signals quedan en shadow (auditables en el Shadow Inbox del modal).
      </InfoBanner>

      <Field label="Nombre de la estrategia *" hint="Cómo querés identificar esta estrategia en tu dashboard. No afecta el comportamiento.">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="SPX Iron Condor v1"
          className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]" />
      </Field>

      <Field label="Subyacentes *" hint="Hasta 10 simbolos. El primero se usa como referencia.">
        <InstrumentMultiSelect value={instruments} onChange={setInstruments} error={instrumentsError} />
      </Field>
      <Field label="Estrategia" hint="Define la estructura del spread (iron condor, vertical, straddle…). Cada estrategia tiene perfil de riesgo distinto.">
        <Select value={strategy} onChange={setStrategy}>
          {OPTIONS_STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </Field>

      {selectedStrat && (
        <p className="text-[10px] text-[#475569] -mt-1">{selectedStrat.desc}</p>
      )}

      <Field label="Dirección / Bias" hint="Bullish = solo entradas BUY del subyacente. Bearish = solo SELL. Neutral = espera mean-reversion. Both = el engine decide.">
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

      {/* Execution platform badge — options always route through IBKR */}
      <div className="flex items-center gap-2 rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/5 px-3 py-2">
        <span className="text-[10px] text-[#475569] uppercase tracking-wider">Plataforma de ejecución</span>
        <span className="text-xs font-bold text-[#a78bfa] font-mono">IBKR</span>
        <span className="text-[10px] text-[#2d3748] ml-auto">Auto-seleccionada por mercado=options</span>
      </div>
    </div>
  );
}

// Step 2 overrides moved to ./AlgorithmWizardStep2.client.tsx

// ─── Step extra: Latency Arb Pairing (renderiza sólo si template = latency_arb_mt5)
// Exported for unit testing — used in-place by the wizard, but can be rendered
// standalone in component tests to verify pairing validation logic.

export function StepLatencyArbPairing({
  botAccounts, fastBotAccountId, slowBotAccountId, setSlowBotAccountId,
  cfg, setCfg,
}: {
  botAccounts: BotAccount[];
  fastBotAccountId: string;
  slowBotAccountId: string;
  setSlowBotAccountId: (v: string) => void;
  cfg: { max_skew_points: string; min_pulse_ticks: string; pulse_window_ms: string; min_hold_seconds: string; max_hold_seconds: string };
  setCfg: (k: keyof typeof cfg, v: string) => void;
}) {
  const slowOptions = botAccounts.filter((a) => a.id !== fastBotAccountId);
  const collision = !!fastBotAccountId && fastBotAccountId === slowBotAccountId;

  return (
    <div className="mt-5 space-y-4 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-4">
      <div>
        <p className="text-[11px] font-mono font-bold text-[#a78bfa] uppercase tracking-wider mb-1">Latency Arb · pairing cross-broker</p>
        <p className="text-[10px] text-[#64748b]">Selecciona dos cuentas MT5 en brokers distintos. El broker rápido define la dirección; el broker lento ejecuta la entrada.</p>
      </div>

      <Field label="Broker rápido (fast)" hint="Broker que adelanta el tick">
        <div className="text-xs text-[#94a3b8] py-2 px-3 rounded-md border border-[#1f2937] bg-[#0a0e1a]">
          {botAccounts.find((a) => a.id === fastBotAccountId)?.label ?? '— elige una cuenta en el campo Broker arriba —'}
        </div>
      </Field>

      <Field label="Broker lento (slow)" hint="Broker que recibe la orden de entrada">
        <Select value={slowBotAccountId} onChange={setSlowBotAccountId}>
          <option value="">— elige una cuenta —</option>
          {slowOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.label} ({a.account_id})</option>
          ))}
        </Select>
      </Field>

      {collision && (
        <p className="text-[10px] text-[#f87171]">El broker fast y slow no pueden ser la misma cuenta.</p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1f2937]">
        <Field label="Max skew (pts)" hint="Threshold de divergencia">
          <NumInput value={cfg.max_skew_points} onChange={(v) => setCfg('max_skew_points', v)}
            step="1" min="1" placeholder="30" />
        </Field>
        <Field label="Min pulse ticks" hint="Confirmaciones requeridas">
          <NumInput value={cfg.min_pulse_ticks} onChange={(v) => setCfg('min_pulse_ticks', v)}
            step="1" min="1" placeholder="5" />
        </Field>
        <Field label="Pulse window (ms)" hint="Ventana de validación">
          <NumInput value={cfg.pulse_window_ms} onChange={(v) => setCfg('pulse_window_ms', v)}
            step="100" min="100" placeholder="800" />
        </Field>
        <Field label="Min hold (seg)" hint="Tiempo mínimo de exposición">
          <NumInput value={cfg.min_hold_seconds} onChange={(v) => setCfg('min_hold_seconds', v)}
            step="5" min="5" placeholder="60" />
        </Field>
        <Field label="Max hold (seg)" hint="Hard exit (10–600)">
          <NumInput value={cfg.max_hold_seconds} onChange={(v) => setCfg('max_hold_seconds', v)}
            step="10" min="10" placeholder="300" />
        </Field>
      </div>
    </div>
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
  // Sprint F — dispatcher reads these to derive SL/TP from ATR × multiplier.
  // Empty → dispatcher uses sensible defaults (1.5 / 3.0).
  sl_atr_mult: '', tp_atr_mult: '',
};
const OPTIONS_OVERRIDES_INIT: Record<string, string> = {
  target_delta: '', min_iv_rank: '', min_dte: '', max_dte: '', max_contracts: '', max_premium_usd: '',
};

export function NewStrategyWizard({ onClose }: { onClose: () => void }) {
  const [stepIdx,     setStepIdx]     = useState(0);
  const [saving,      setSaving]      = useState(false);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [bots,        setBots]        = useState<{ id: string; name: string }[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccNumber,   setNewAccNumber]   = useState('');
  const [newAccLabel,    setNewAccLabel]    = useState('');
  const [newAccPlatform, setNewAccPlatform] = useState<'MT4' | 'MT5'>('MT5');
  const [selectedPlatform, setSelectedPlatform] = useState<'MT4' | 'MT5'>('MT5');
  const [addingAccount,  setAddingAccount]  = useState(false);
  const router = useRouter();

  // Algorithm templates (system presets, e.g. GoldRangeBasketR)
  const [templates,           setTemplates]           = useState<AlgorithmTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateBotAccountByKey, setTemplateBotAccountByKey] = useState<Record<string, string>>({});

  // CME account management
  const [cmeAccounts,       setCmeAccounts]       = useState<CmeAccount[]>([]);
  const [cmeAccountId,      setCmeAccountId]      = useState('');
  const [showAddCmeAccount, setShowAddCmeAccount] = useState(false);
  const [newCmeType,        setNewCmeType]        = useState<'propfirm' | 'broker'>('broker');
  const [newCmeProvider,    setNewCmeProvider]    = useState('IBKR');
  const [newCmeNumber,      setNewCmeNumber]      = useState('');
  const [newCmeLabel,       setNewCmeLabel]       = useState('');
  const [newCmeFunded,      setNewCmeFunded]      = useState('');
  const [newCmeMaxLoss,     setNewCmeMaxLoss]     = useState('');
  const [newCmeTrailingDD,  setNewCmeTrailingDD]  = useState('');
  const [addingCmeAccount,  setAddingCmeAccount]  = useState(false);

  // Common
  const [name,       setName]       = useState('');
  const [marketType, setMarketType] = useState<MarketType>('forex');
  const [direction,  setDirection]  = useState<Direction>('both');

  // Forex-specific
  const [botAccountId, setBotAccountId] = useState('');

  // Latency-arb specific (only used when selectedTemplateKey === 'latency_arb_mt5')
  const [slowBotAccountId, setSlowBotAccountId] = useState('');
  const [latencyArbCfg, setLatencyArbCfg] = useState({
    max_skew_points:  '30',
    min_pulse_ticks:  '5',
    pulse_window_ms:  '800',
    min_hold_seconds: '60',
    max_hold_seconds: '300',
  });

  // Futures-specific
  const [contract,      setContract]      = useState('ES');
  const [hedgeEnabled,  setHedgeEnabled]  = useState(false);
  const [hedgeContract, setHedgeContract] = useState('NQ');

  // Options-specific
  const [underlying,       setUnderlying]       = useState('SPX');
  const [optionsStrategy,  setOptionsStrategy]  = useState('iron_condor');
  const [optionsDirection, setOptionsDirection] = useState<OptionsDirection>('neutral');
  const [ibkrAccount,      setIbkrAccount]      = useState('');

  // Overrides (per market type)
  const [forexOvr,   setForexOvr]   = useState<Record<string, string>>(FOREX_OVERRIDES_INIT);
  const [futuresOvr, setFuturesOvr] = useState<Record<string, string>>(FUTURES_OVERRIDES_INIT);
  const [optionsOvr, setOptionsOvr] = useState<Record<string, string>>(OPTIONS_OVERRIDES_INIT);

  // Engine config (Base Engine v1 + modules + overlays)
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(ENGINE_CONFIG_DEFAULT);

  // Multi-instrument selection (replaces legA/contract/underlying as the source of truth)
  const [instruments, setInstruments]               = useState<string[]>(['XAUUSD']);
  const [instrumentsError, setInstrumentsError]     = useState<string>('');

  const setOvr = (market: MarketType) => (k: string, v: string) => {
    if (market === 'forex')   setForexOvr((o)   => ({ ...o, [k]: v }));
    if (market === 'futures') setFuturesOvr((o) => ({ ...o, [k]: v }));
    if (market === 'options') setOptionsOvr((o) => ({ ...o, [k]: v }));
  };

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from('bots').select('id, name'),
      sb.from('bot_accounts').select('id, label, account_id'),
      sb.from('algo_cme_accounts').select('*').is('deleted_at', null),
      sb.from('algorithm_templates').select('*').eq('is_active', true).order('sort_index'),
    ]).then(([botsRes, accsRes, cmeRes, tmplRes]) => {
      const accs = (accsRes.data ?? []) as BotAccount[];
      setBots(botsRes.data ?? []);
      setBotAccounts(accs);
      setCmeAccounts((cmeRes.data ?? []) as CmeAccount[]);
      setTemplates((tmplRes.data ?? []) as AlgorithmTemplate[]);

      // Map known template_key -> placeholder bot_account.id (created by migration 079).
      const goldPlaceholder = accs.find((a) => a.account_id === 'PENDING-GOLDRANGE');
      if (goldPlaceholder) {
        setTemplateBotAccountByKey({ goldrangebasketr: goldPlaceholder.id });
      }
    });
  }, []);

  function handleTemplateChange(key: string) {
    setSelectedTemplateKey(key);
    if (!key) return;
    const t = templates.find((x) => x.template_key === key);
    if (!t) return;

    if (!name.trim()) setName(t.name);
    setInstruments([t.default_instrument]);
    setInstrumentsError('');
    if (t.default_direction !== 'both') setDirection(t.default_direction);

    // Auto-select the only supported platform if the template restricts it.
    if (t.supported_platforms?.length === 1) {
      setSelectedPlatform(t.supported_platforms[0] as 'MT4' | 'MT5');
    }

    // Map common engine overrides from template parameters.
    const params = t.parameters ?? {};
    const numericFromParams = (k: string): string => {
      const v = (params as Record<string, unknown>)[k];
      return typeof v === 'number' ? String(v) : '';
    };
    setForexOvr((prev) => ({
      ...prev,
      lot_per_leg:        prev.lot_per_leg        || String(t.default_lot_size),
      max_concurrent:     prev.max_concurrent     || String(t.default_max_trades),
      max_daily_loss_pct: prev.max_daily_loss_pct || String(t.default_risk_percent),
      daily_op_limit:     prev.daily_op_limit     || numericFromParams('max_entries_per_bar'),
    }));

    // Auto-select the linked bot_account placeholder (if user hasn't picked one).
    const placeholderId = templateBotAccountByKey[key];
    if (placeholderId && !botAccountId) setBotAccountId(placeholderId);

    // Seed latency-arb config from template defaults when applicable.
    if (key === 'latency_arb_mt5') {
      setLatencyArbCfg({
        max_skew_points:  String(numericFromParams('max_skew_points')  || '30'),
        min_pulse_ticks:  String(numericFromParams('min_pulse_ticks')  || '5'),
        pulse_window_ms:  String(numericFromParams('pulse_window_ms')  || '800'),
        min_hold_seconds: String(numericFromParams('min_hold_seconds') || '60'),
        max_hold_seconds: String(numericFromParams('max_hold_seconds') || '300'),
      });
    }
  }

  async function handleAddAccount() {
    if (!newAccNumber.trim()) { toast.error('El número de cuenta es obligatorio'); return; }
    const botId = bots[0]?.id;
    if (!botId) { toast.error('Configura un bot primero en Bot Control'); return; }
    setAddingAccount(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { toast.error('No autenticado'); setAddingAccount(false); return; }
    const label = `${newAccPlatform} — ${newAccLabel.trim() || newAccNumber.trim()}`;
    const { data, error } = await sb
      .from('bot_accounts')
      .insert({ user_id: user.id, bot_id: botId, account_id: newAccNumber.trim(), label })
      .select('id, label, account_id')
      .single();
    if (error) {
      toast.error('Error al crear cuenta: ' + error.message);
    } else if (data) {
      setBotAccounts((prev) => [...prev, data as BotAccount]);
      setBotAccountId(data.id);
      setShowAddAccount(false);
      setNewAccNumber('');
      setNewAccLabel('');
      setNewAccPlatform('MT5');
      toast.success('Cuenta agregada y seleccionada');
    }
    setAddingAccount(false);
  }

  async function handleAddCmeAccount() {
    if (!newCmeNumber.trim()) { toast.error('El número de cuenta es obligatorio'); return; }
    setAddingCmeAccount(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { toast.error('No autenticado'); setAddingCmeAccount(false); return; }
    const { data, error } = await sb.from('algo_cme_accounts').insert({
      user_id:         user.id,
      account_type:    newCmeType,
      provider_name:   newCmeProvider,
      account_number:  newCmeNumber.trim(),
      label:           newCmeLabel.trim() || null,
      funded_amount:   newCmeFunded    ? Number(newCmeFunded)    : null,
      max_daily_loss:  newCmeMaxLoss   ? Number(newCmeMaxLoss)   : null,
      max_trailing_dd: newCmeTrailingDD ? Number(newCmeTrailingDD) : null,
    }).select('*').single();
    if (error) {
      toast.error('Error al crear cuenta: ' + error.message);
    } else if (data) {
      setCmeAccounts((prev) => [...prev, data as CmeAccount]);
      setCmeAccountId(data.id);
      setShowAddCmeAccount(false);
      setNewCmeNumber(''); setNewCmeLabel('');
      setNewCmeFunded(''); setNewCmeMaxLoss(''); setNewCmeTrailingDD('');
      toast.success('Cuenta CME guardada y seleccionada');
    }
    setAddingCmeAccount(false);
  }

  const isFirst = stepIdx === 0;
  const isLast  = stepIdx === STEPS.length - 1;

  async function handleCreate() {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); setStepIdx(0); return; }
    if (instruments.length === 0) {
      setInstrumentsError('Selecciona al menos un instrumento');
      toast.error('Selecciona al menos un instrumento');
      setStepIdx(0);
      return;
    }
    setInstrumentsError('');
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('No autenticado'); return; }

      // Build engine overrides — only non-empty values
      const ovr = marketType === 'forex' ? forexOvr : marketType === 'futures' ? futuresOvr : optionsOvr;
      const engineOverrides: Record<string, number> = {};
      Object.entries(ovr).forEach(([k, v]) => { if (v !== '') engineOverrides[k] = Number(v); });

      // Primary instrument drives derived fields (parameters.leg_a_instrument,
      // parameters.contract, parameters.underlying, latency-arb pair symbol).
      // The full array goes to algorithms.instrument (text[]).
      const primary = instruments[0];

      // Build parameters JSONB — engine overrides first; if a template is selected,
      // its base parameters are merged underneath so the engine has full context
      // but user overrides win.
      const selectedTemplate = templates.find((t) => t.template_key === selectedTemplateKey);
      const templateParams = selectedTemplate?.parameters ?? {};
      const parameters: Record<string, unknown> = { ...templateParams, ...engineOverrides };
      if (selectedTemplate) {
        parameters.template_key  = selectedTemplate.template_key;
        parameters.template_name = selectedTemplate.name;
        if (selectedTemplate.magic_number != null) parameters.magic_number = selectedTemplate.magic_number;
        if (selectedTemplate.source_path)         parameters.source_path  = selectedTemplate.source_path;
      }
      if (marketType === 'forex') {
        parameters.leg_a_instrument = primary;
      } else if (marketType === 'futures') {
        parameters.contract        = contract || primary;
        parameters.hedge_enabled   = hedgeEnabled;
        if (hedgeEnabled) parameters.hedge_contract = hedgeContract;
        // Linked CME account
        parameters.cme_account_id = cmeAccountId || null;
        const selectedCme = cmeAccounts.find((a) => a.id === cmeAccountId);
        if (selectedCme) {
          parameters.cme_provider    = selectedCme.provider_name;
          parameters.cme_account_num = selectedCme.account_number;
          parameters.cme_type        = selectedCme.account_type;
        }
      } else {
        parameters.underlying        = primary;
        parameters.options_strategy  = optionsStrategy;
        parameters.ibkr_account      = ibkrAccount || null;
        parameters.options_direction = optionsDirection;
      }

      // Normalize direction for DB (options 4-value → 3-value DB enum)
      const dbDirection: Direction =
        marketType === 'options'
          ? optionsDirection === 'bullish' ? 'long' : optionsDirection === 'bearish' ? 'short' : 'both'
          : direction;

      // Map DB columns by market type
      const lotSize =
        marketType === 'forex'   ? (engineOverrides.lot_per_leg      ?? 0.01) :
        marketType === 'futures' ? (engineOverrides.contracts_per_trade ?? 1)  :
                                   (engineOverrides.max_contracts     ?? 5);
      const maxTrades =
        marketType === 'forex'   ? (engineOverrides.max_concurrent    ?? 5) :
                                   (engineOverrides.contracts_per_trade ?? 1);
      const riskPercent =
        marketType === 'forex'   ? (engineOverrides.max_daily_loss_pct ?? 3.0)  :
        marketType === 'futures' ? (engineOverrides.max_daily_loss_usd ?? 500)  :
                                   (engineOverrides.max_premium_usd   ?? 200);

      const isLatencyArb = selectedTemplateKey === 'latency_arb_mt5';

      // Pre-validate latency-arb pairing before touching the DB.
      if (isLatencyArb) {
        if (!botAccountId)               { toast.error('Selecciona el broker rápido (fast)'); setStepIdx(0); return; }
        if (!slowBotAccountId)           { toast.error('Selecciona el broker lento (slow)');  setStepIdx(0); return; }
        if (botAccountId === slowBotAccountId) {
          toast.error('Fast y slow no pueden ser la misma cuenta'); setStepIdx(0); return;
        }
      }

      // Auto-bind execution platform from market_type. Futures propfirm =
      // Tradovate (only venue that interfaces with the major prop firms);
      // options = IBKR; forex respects the user's MT4/MT5 choice. Without
      // this the algorithm dispatcher has no way to know where to route.
      const resolvedPlatform: 'MT4' | 'MT5' | 'Tradovate' | 'IBKR' =
        marketType === 'forex'   ? selectedPlatform :
        marketType === 'futures' ? 'Tradovate' :
        marketType === 'options' ? 'IBKR' :
                                   'MT5';

      const { data: created, error } = await supabase.from('algorithms').insert({
        user_id:               user.id,
        name:                  name.trim(),
        instrument:            instruments,
        market_type:           marketType,
        direction:             dbDirection,
        platform:              resolvedPlatform,
        linked_bot_account_id: marketType === 'forex' ? (botAccountId || null) : null,
        lot_size:              lotSize,
        max_trades:            maxTrades,
        risk_percent:          riskPercent,
        parameters,
        engine_config:         engineConfig,
        scan_config: {},
        status: 'paused',
      }).select('id').single();

      if (error) { toast.error(error.message); return; }

      if (isLatencyArb && created?.id) {
        const pairInsert = await supabase.from('arbitrage_latency_pairs').insert({
          user_id:             user.id,
          algorithm_id:        created.id,
          fast_bot_account_id: botAccountId,
          slow_bot_account_id: slowBotAccountId,
          symbol:              primary,
          max_skew_points:     Number(latencyArbCfg.max_skew_points)  || 30,
          min_pulse_ticks:     Number(latencyArbCfg.min_pulse_ticks)  || 5,
          pulse_window_ms:     Number(latencyArbCfg.pulse_window_ms)  || 800,
          min_hold_seconds:    Number(latencyArbCfg.min_hold_seconds) || 60,
          max_hold_seconds:    Number(latencyArbCfg.max_hold_seconds) || 300,
          enabled:             false,
        });
        if (pairInsert.error) {
          toast.error('Algorithm creado, pero el pairing falló: ' + pairInsert.error.message);
          return;
        }
      }

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
              instruments={instruments} setInstruments={setInstruments} instrumentsError={instrumentsError}
              direction={direction} setDirection={setDirection}
              botAccountId={botAccountId} setBotAccountId={setBotAccountId}
              botAccounts={botAccounts}
              showAddAccount={showAddAccount} setShowAddAccount={setShowAddAccount}
              newAccNumber={newAccNumber} setNewAccNumber={setNewAccNumber}
              newAccLabel={newAccLabel} setNewAccLabel={setNewAccLabel}
              newAccPlatform={newAccPlatform} setNewAccPlatform={setNewAccPlatform}
              addingAccount={addingAccount} handleAddAccount={handleAddAccount}
              templates={templates}
              selectedTemplateKey={selectedTemplateKey}
              onTemplateChange={handleTemplateChange}
              selectedPlatform={selectedPlatform}
              setSelectedPlatform={setSelectedPlatform}
            />
          )}
          {stepIdx === 0 && marketType === 'forex' && selectedTemplateKey === 'latency_arb_mt5' && (
            <StepLatencyArbPairing
              botAccounts={botAccounts}
              fastBotAccountId={botAccountId}
              slowBotAccountId={slowBotAccountId}
              setSlowBotAccountId={setSlowBotAccountId}
              cfg={latencyArbCfg}
              setCfg={(k, v) => setLatencyArbCfg((c) => ({ ...c, [k]: v }))}
            />
          )}
          {stepIdx === 0 && marketType === 'futures' && (
            <StepFutures
              name={name} setName={setName}
              contract={contract}
              setContract={(v) => {
                setContract(v);
                if (hedgeContract === v) {
                  const fallback = FUTURES_CONTRACTS.find((c) => c.symbol !== v);
                  setHedgeContract(fallback?.symbol ?? '');
                }
              }}
              instruments={instruments} setInstruments={setInstruments} instrumentsError={instrumentsError}
              direction={direction} setDirection={setDirection}
              hedgeEnabled={hedgeEnabled} setHedgeEnabled={setHedgeEnabled}
              hedgeContract={hedgeContract} setHedgeContract={setHedgeContract}
              cmeAccounts={cmeAccounts}
              cmeAccountId={cmeAccountId} setCmeAccountId={setCmeAccountId}
              showAddCmeAccount={showAddCmeAccount} setShowAddCmeAccount={setShowAddCmeAccount}
              newCmeType={newCmeType} setNewCmeType={setNewCmeType}
              newCmeProvider={newCmeProvider} setNewCmeProvider={setNewCmeProvider}
              newCmeNumber={newCmeNumber} setNewCmeNumber={setNewCmeNumber}
              newCmeLabel={newCmeLabel} setNewCmeLabel={setNewCmeLabel}
              newCmeFunded={newCmeFunded} setNewCmeFunded={setNewCmeFunded}
              newCmeMaxLoss={newCmeMaxLoss} setNewCmeMaxLoss={setNewCmeMaxLoss}
              newCmeTrailingDD={newCmeTrailingDD} setNewCmeTrailingDD={setNewCmeTrailingDD}
              addingCmeAccount={addingCmeAccount} handleAddCmeAccount={handleAddCmeAccount}
            />
          )}
          {stepIdx === 0 && marketType === 'options' && (
            <StepOptions
              name={name} setName={setName}
              underlying={underlying} setUnderlying={setUnderlying}
              instruments={instruments} setInstruments={setInstruments} instrumentsError={instrumentsError}
              strategy={optionsStrategy} setStrategy={setOptionsStrategy}
              direction={optionsDirection} setDirection={setOptionsDirection}
              ibkrAccount={ibkrAccount} setIbkrAccount={setIbkrAccount}
            />
          )}

          {/* Step 2 — Base Engine + modules + overlays + market-typed overrides */}
          {stepIdx === 1 && (
            <AlgorithmWizardStep2
              value={engineConfig}
              onChange={setEngineConfig}
              overrides={marketType === 'forex' ? forexOvr : marketType === 'futures' ? futuresOvr : optionsOvr}
              onOverridesChange={setOvr(marketType)}
              marketType={marketType}
            />
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
