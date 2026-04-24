"use client";
import type { GridBasketParams } from "@/types/algorithms";

interface Props { value: GridBasketParams; onChange: (v: GridBasketParams) => void; }

const SESSION_OPTIONS = ["LONDON", "NY", "OVERLAP"] as const;
const TF_OPTIONS      = ["M1", "M5", "M15"] as const;
const DIR_OPTIONS     = ["BUY_ONLY", "SELL_ONLY", "BOTH"] as const;
const DIR_LABELS      = { BUY_ONLY: "Solo Compra", SELL_ONLY: "Solo Venta", BOTH: "Ambas" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, color = "cyan", onChange }: {
  value: number; min: number; max: number; step?: number; color?: string; onChange: (v: number) => void;
}) {
  const accent = color === "cyan" ? "accent-cyan-500" : "accent-slate-500";
  const text   = color === "cyan" ? "text-cyan-300"   : "text-slate-300";
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`flex-1 ${accent}`} />
      <span className={`w-14 text-right text-sm font-mono ${text}`}>{value}</span>
    </div>
  );
}

export default function GridParamsForm({ value: v, onChange }: Props) {
  const set = <K extends keyof GridBasketParams>(k: K, val: GridBasketParams[K]) =>
    onChange({ ...v, [k]: val });

  const toggleSession = (s: typeof SESSION_OPTIONS[number]) => {
    const arr = v.sessions.includes(s) ? v.sessions.filter((x) => x !== s) : [...v.sessions, s];
    set("sessions", arr);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Timeframe">
        <div className="flex gap-2">
          {TF_OPTIONS.map((tf) => (
            <button key={tf} type="button" onClick={() => set("timeframe", tf)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.timeframe === tf ? "bg-cyan-700 border-cyan-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-cyan-600"}`}>
              {tf}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Dirección">
        <div className="flex gap-2 flex-wrap">
          {DIR_OPTIONS.map((d) => (
            <button key={d} type="button" onClick={() => set("direction", d)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.direction === d ? "bg-cyan-700 border-cyan-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-cyan-600"}`}>
              {DIR_LABELS[d]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Sesiones activas">
        <div className="flex gap-2">
          {SESSION_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => toggleSession(s)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                v.sessions.includes(s) ? "bg-cyan-700 border-cyan-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-cyan-600"}`}>
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Paso de grid (puntos)" hint="Distancia entre niveles de la grilla">
        <NumberInput value={v.grid_step_points} min={50} max={1000} step={10} onChange={(n) => set("grid_step_points", n)} />
      </Field>

      <Field label="Tamaño máximo del basket" hint="Número máximo de órdenes abiertas">
        <NumberInput value={v.max_basket_size} min={2} max={20} onChange={(n) => set("max_basket_size", n)} />
      </Field>

      <Field label="Lote inicial">
        <NumberInput value={v.initial_lot} min={0.01} max={2} step={0.01} onChange={(n) => set("initial_lot", n)} />
      </Field>

      <Field label="Multiplicador de lote" hint="Martingala: cada nivel multiplica el lote anterior">
        <NumberInput value={v.lot_multiplier} min={1.0} max={3.0} step={0.1} onChange={(n) => set("lot_multiplier", n)} />
      </Field>

      <Field label="TP del basket (puntos)" hint="Cierra todo el basket al alcanzar este profit">
        <NumberInput value={v.basket_tp_points} min={100} max={5000} step={50} onChange={(n) => set("basket_tp_points", n)} />
      </Field>

      <Field label="Circuit breaker (%)" hint="Cierra todo si la pérdida diaria supera este %">
        <NumberInput value={v.circuit_breaker_pct} min={1} max={25} onChange={(n) => set("circuit_breaker_pct", n)} />
      </Field>

      <Field label="Spread máximo (puntos)">
        <NumberInput value={v.max_spread} min={0} max={100} onChange={(n) => set("max_spread", n)} />
      </Field>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="button"
          onClick={() => set("use_martingale", !v.use_martingale)}
          className={`relative w-10 h-5 rounded-full transition-colors ${v.use_martingale ? "bg-orange-600" : "bg-slate-700"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${v.use_martingale ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm text-slate-300">Martingala activa</span>
        {v.use_martingale && (
          <span className="text-xs text-orange-400 bg-orange-950 border border-orange-800 px-2 py-0.5 rounded">Alto riesgo</span>
        )}
      </div>
    </div>
  );
}
