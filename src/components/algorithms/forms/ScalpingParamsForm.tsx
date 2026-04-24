"use client";
import type { ScalpingParams } from "@/types/algorithms";

interface Props {
  value: ScalpingParams;
  onChange: (v: ScalpingParams) => void;
}

const SESSION_OPTIONS = ["LONDON", "NY", "OVERLAP"] as const;
const TF_OPTIONS = ["M1", "M5", "M15", "M30"] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, onChange }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500"
      />
      <span className="w-14 text-right text-sm font-mono text-violet-300">{value}</span>
    </div>
  );
}

export default function ScalpingParamsForm({ value: v, onChange }: Props) {
  const set = <K extends keyof ScalpingParams>(k: K, val: ScalpingParams[K]) =>
    onChange({ ...v, [k]: val });

  const toggleSession = (s: typeof SESSION_OPTIONS[number]) => {
    const arr = v.sessions.includes(s) ? v.sessions.filter((x) => x !== s) : [...v.sessions, s];
    set("sessions", arr);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Timeframe">
        <div className="flex gap-2 flex-wrap">
          {TF_OPTIONS.map((tf) => (
            <button key={tf} type="button"
              onClick={() => set("timeframe", tf)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.timeframe === tf
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-600"
              }`}
            >{tf}</button>
          ))}
        </div>
      </Field>

      <Field label="Sesiones activas">
        <div className="flex gap-2">
          {SESSION_OPTIONS.map((s) => (
            <button key={s} type="button"
              onClick={() => toggleSession(s)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.sessions.includes(s)
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-600"
              }`}
            >{s}</button>
          ))}
        </div>
      </Field>

      <Field label="Stop Loss (puntos)" hint="Distancia en puntos del precio de entrada">
        <NumberInput value={v.sl_points} min={10} max={300} onChange={(n) => set("sl_points", n)} />
      </Field>

      <Field label="Take Profit (puntos)" hint="Objetivo de ganancia en puntos">
        <NumberInput value={v.tp_points} min={10} max={600} onChange={(n) => set("tp_points", n)} />
      </Field>

      <Field label="Máx. posiciones simultáneas">
        <NumberInput value={v.max_positions} min={1} max={10} onChange={(n) => set("max_positions", n)} />
      </Field>

      <Field label="Spread máximo (puntos)" hint="No opera si el spread supera este valor">
        <NumberInput value={v.max_spread} min={0} max={100} onChange={(n) => set("max_spread", n)} />
      </Field>

      <Field label="Tamaño de lote inicial">
        <NumberInput value={v.lot_size} min={0.01} max={10} step={0.01} onChange={(n) => set("lot_size", n)} />
      </Field>

      <Field label="Lote máximo">
        <NumberInput value={v.max_lot_size} min={0.01} max={10} step={0.01} onChange={(n) => set("max_lot_size", n)} />
      </Field>

      <Field label="Umbral de momentum" hint="Señal mínima requerida para operar (0.1–1.0)">
        <NumberInput value={v.momentum_threshold} min={0.1} max={1.0} step={0.05} onChange={(n) => set("momentum_threshold", n)} />
      </Field>

      <Field label="Umbral de volatilidad mínima" hint="ATR/precio ratio mínimo para operar">
        <NumberInput value={v.min_vol_threshold} min={0.001} max={0.05} step={0.001} onChange={(n) => set("min_vol_threshold", n)} />
      </Field>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="button"
          onClick={() => set("use_trailing_stop", !v.use_trailing_stop)}
          className={`relative w-10 h-5 rounded-full transition-colors ${v.use_trailing_stop ? "bg-violet-600" : "bg-slate-700"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${v.use_trailing_stop ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm text-slate-300">Trailing Stop</span>
      </div>

      {v.use_trailing_stop && (
        <Field label="Distancia trailing (puntos)">
          <NumberInput value={v.trailing_distance} min={5} max={200} onChange={(n) => set("trailing_distance", n)} />
        </Field>
      )}
    </div>
  );
}
