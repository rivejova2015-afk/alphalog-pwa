"use client";
import type { ArbitrageParams } from "@/types/algorithms";

interface Props { value: ArbitrageParams; onChange: (v: ArbitrageParams) => void; }

const SESSION_OPTIONS = ["LONDON", "NY", "OVERLAP"] as const;
const INSTRUMENTS     = ["XAUUSD","XAGUSD","EURUSD","GBPUSD","USDJPY","USDCAD","AUDUSD","USDCHF","NZDUSD","US30","US500","NAS100"] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({ value, min, max, step = 0.1, onChange }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-amber-500" />
      <span className="w-14 text-right text-sm font-mono text-amber-300">{value}</span>
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm px-3 py-2 focus:border-amber-500 focus:outline-none">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function ArbitrageParamsForm({ value: v, onChange }: Props) {
  const set = <K extends keyof ArbitrageParams>(k: K, val: ArbitrageParams[K]) =>
    onChange({ ...v, [k]: val });

  const toggleSession = (s: typeof SESSION_OPTIONS[number]) => {
    const arr = v.sessions.includes(s) ? v.sessions.filter((x) => x !== s) : [...v.sessions, s];
    set("sessions", arr);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2 rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300">
        El arbitraje estadístico abre posiciones opuestas en dos instrumentos correlacionados cuando su spread histórico diverge del promedio.
      </div>

      <Field label="Instrumento A (Largo)">
        <Select value={v.instrument_a} options={INSTRUMENTS} onChange={(s) => set("instrument_a", s)} />
      </Field>

      <Field label="Instrumento B (Corto)">
        <Select value={v.instrument_b} options={INSTRUMENTS} onChange={(s) => set("instrument_b", s)} />
      </Field>

      <Field label="Sesiones activas">
        <div className="flex gap-2 flex-wrap">
          {SESSION_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => toggleSession(s)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.sessions.includes(s) ? "bg-amber-700 border-amber-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-600"}`}>
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Umbral de entrada (z-score)" hint="Abre posición cuando el z-score supera este valor">
        <NumberInput value={v.spread_threshold} min={0.5} max={5.0} step={0.1} onChange={(n) => set("spread_threshold", n)} />
      </Field>

      <Field label="Umbral de cierre (z-score)" hint="Cierra posición cuando el z-score cae por debajo">
        <NumberInput value={v.exit_threshold} min={0.1} max={2.0} step={0.1} onChange={(n) => set("exit_threshold", n)} />
      </Field>

      <Field label="Correlación mínima" hint="No opera si la correlación es inferior a este valor">
        <NumberInput value={v.min_correlation} min={0.5} max={1.0} step={0.05} onChange={(n) => set("min_correlation", n)} />
      </Field>

      <Field label="Ratio de cobertura (hedge ratio)" hint="Unidades de B por unidad de A">
        <NumberInput value={v.hedge_ratio} min={0.1} max={5.0} step={0.1} onChange={(n) => set("hedge_ratio", n)} />
      </Field>

      <Field label="Exposición máxima (lotes)">
        <NumberInput value={v.max_exposure_lots} min={0.01} max={5} step={0.01} onChange={(n) => set("max_exposure_lots", n)} />
      </Field>

      <Field label="Tamaño de lote por operación">
        <NumberInput value={v.lot_size} min={0.01} max={2} step={0.01} onChange={(n) => set("lot_size", n)} />
      </Field>

      <Field label="Tiempo máximo abierto (min)" hint="Cierra forzado si la posición no converge">
        <NumberInput value={v.max_hold_minutes} min={1} max={1440} step={1} onChange={(n) => set("max_hold_minutes", n)} />
      </Field>
    </div>
  );
}
