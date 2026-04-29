'use client';

import { Plus, X } from 'lucide-react';
import type { AlgorithmRules, Condition, IndicatorRef, Operator } from '@/types/backtest';

interface RuleBuilderProps {
  rules: AlgorithmRules;
  onChange: (next: AlgorithmRules) => void;
}

const INDICATORS: IndicatorRef['type'][] = ['price', 'sma', 'ema', 'rsi', 'atr', 'bb_upper', 'bb_lower', 'macd'];
const FIELDS: NonNullable<IndicatorRef['field']>[] = ['close', 'open', 'high', 'low'];
const OPERATORS: Operator[] = ['>', '<', '>=', '<=', '==', 'cross_above', 'cross_below'];
const NEEDS_PERIOD = new Set(['sma', 'ema', 'rsi', 'atr', 'bb_upper', 'bb_lower', 'macd']);

export function BacktestRuleBuilder({ rules, onChange }: RuleBuilderProps) {
  const update = (patch: Partial<AlgorithmRules>) => onChange({ ...rules, ...patch });

  return (
    <div className="space-y-3 p-3 rounded bg-[#0f1322] border border-[#1f2937]">
      <p className="text-[10px] uppercase tracking-wide text-[#475569] font-medium">Reglas del algoritmo</p>

      <ConditionList
        label="Entry LONG"  color="#34d399"
        list={rules.entryLong  ?? []} onChange={(list) => update({ entryLong:  list })}
      />
      <ConditionList
        label="Entry SHORT" color="#ef4444"
        list={rules.entryShort ?? []} onChange={(list) => update({ entryShort: list })}
      />
      <ConditionList
        label="Exit LONG"  color="#94a3b8"
        list={rules.exitLong  ?? []} onChange={(list) => update({ exitLong:  list })}
      />
      <ConditionList
        label="Exit SHORT" color="#94a3b8"
        list={rules.exitShort ?? []} onChange={(list) => update({ exitShort: list })}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#1f2937]">
        <NumField  label="SL points" value={rules.slPoints ?? 0} onChange={(v) => update({ slPoints: v || undefined })} />
        <NumField  label="TP points" value={rules.tpPoints ?? 0} onChange={(v) => update({ tpPoints: v || undefined })} />
        <NumField  label="Max concurrent" value={rules.maxConcurrent ?? 1} min={1} max={20}
                   onChange={(v) => update({ maxConcurrent: Math.max(1, v) })} />
        <SizingPicker rules={rules} onChange={onChange} />
      </div>
    </div>
  );
}

function ConditionList({
  label, color, list, onChange,
}: {
  label: string; color: string; list: Condition[]; onChange: (l: Condition[]) => void;
}) {
  const add = () => onChange([...list, defaultCondition()]);
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const replace = (i: number, c: Condition) => onChange(list.map((x, idx) => (idx === i ? c : x)));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
        <button onClick={add} className="text-[10px] flex items-center gap-1 text-[#06b6d4] hover:text-[#22d3ee]">
          <Plus size={10} /> Add
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-[10px] text-[#475569] italic px-1">— no conditions —</div>
      ) : (
        <div className="space-y-1">
          {list.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <SidePicker side={c.left} onChange={(s) => replace(i, { ...c, left: s })} />
              <select
                value={c.op}
                onChange={(e) => replace(i, { ...c, op: e.target.value as Operator })}
                className={selCls + ' min-w-[60px]'}
              >
                {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <SidePicker side={c.right} onChange={(s) => replace(i, { ...c, right: s })} />
              <button onClick={() => remove(i)} className="p-1 text-[#ef4444] hover:bg-[#ef4444]/10 rounded">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidePicker({
  side, onChange,
}: {
  side: IndicatorRef | number;
  onChange: (s: IndicatorRef | number) => void;
}) {
  const isNumber = typeof side === 'number';
  return (
    <div className="flex items-center gap-1">
      <select
        value={isNumber ? 'number' : 'indicator'}
        onChange={(e) => onChange(e.target.value === 'number' ? 0 : { type: 'price', field: 'close' })}
        className={selCls + ' w-[90px]'}
      >
        <option value="indicator">Indicator</option>
        <option value="number">Number</option>
      </select>
      {isNumber ? (
        <input
          type="number"
          step="any"
          value={side}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inpCls + ' w-[80px]'}
        />
      ) : (
        <>
          <select
            value={side.type}
            onChange={(e) => onChange({ ...side, type: e.target.value as IndicatorRef['type'] })}
            className={selCls + ' w-[90px]'}
          >
            {INDICATORS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {NEEDS_PERIOD.has(side.type) && (
            <input
              type="number" min={1} max={500}
              value={side.period ?? 14}
              onChange={(e) => onChange({ ...side, period: Math.max(1, Number(e.target.value)) })}
              className={inpCls + ' w-[55px]'}
            />
          )}
          <select
            value={side.field ?? 'close'}
            onChange={(e) => onChange({ ...side, field: e.target.value as IndicatorRef['field'] })}
            className={selCls + ' w-[70px]'}
          >
            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <label className="block">
      <div className="text-[10px] text-[#475569] uppercase tracking-wide mb-1">{label}</div>
      <input
        type="number"
        min={min} max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inpCls}
      />
    </label>
  );
}

function SizingPicker({ rules, onChange }: { rules: AlgorithmRules; onChange: (r: AlgorithmRules) => void }) {
  return (
    <div>
      <div className="text-[10px] text-[#475569] uppercase tracking-wide mb-1">Sizing</div>
      <div className="flex gap-1">
        <select
          value={rules.sizing.mode}
          onChange={(e) => onChange({ ...rules, sizing: { ...rules.sizing, mode: e.target.value as AlgorithmRules['sizing']['mode'] } })}
          className={selCls + ' flex-1'}
        >
          <option value="fixed_lot">fixed_lot</option>
          <option value="risk_pct">risk_pct</option>
          <option value="kelly">kelly</option>
        </select>
        <input
          type="number" step="0.01" min={0.01}
          value={rules.sizing.value}
          onChange={(e) => onChange({ ...rules, sizing: { ...rules.sizing, value: Number(e.target.value) } })}
          className={inpCls + ' w-[70px]'}
        />
      </div>
    </div>
  );
}

function defaultCondition(): Condition {
  return {
    left:  { type: 'rsi', period: 14, field: 'close' },
    op:    '<',
    right: 30,
  };
}

const inpCls = "rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-[11px] px-1.5 py-0.5 focus:outline-none focus:border-[#475569]";
const selCls = "rounded bg-[#111827] border border-[#1f2937] text-[#e2e8f0] text-[11px] px-1 py-0.5 focus:outline-none focus:border-[#475569]";
