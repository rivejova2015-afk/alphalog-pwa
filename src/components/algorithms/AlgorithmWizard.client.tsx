"use client";
import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import type {
  AlgoPlatform, AlgoType, AlgoParameters,
  ScalpingParams, GridBasketParams, ArbitrageParams,
} from "@/types/algorithms";
import {
  ALGO_TYPE_LABELS,
  DEFAULT_SCALPING_PARAMS, DEFAULT_GRID_PARAMS, DEFAULT_ARBITRAGE_PARAMS,
  MAX_ALGORITHMS_PER_PLATFORM,
} from "@/types/algorithms";
import ScalpingParamsForm  from "./forms/ScalpingParamsForm";
import GridParamsForm      from "./forms/GridParamsForm";
import ArbitrageParamsForm from "./forms/ArbitrageParamsForm";

interface Props {
  platform: AlgoPlatform;
  usedSlots: number[];
  onClose: () => void;
  onCreated: () => void;
}

const STEPS = ["Básico", "Parámetros", "Revisión"] as const;

const TYPE_ICONS: Record<AlgoType, string> = {
  scalping:    "⚡",
  grid_basket: "🔲",
  arbitrage:   "⇄",
};

const TYPE_DESC: Record<AlgoType, string> = {
  scalping:    "Opera en marcos de tiempo cortos capturando movimientos rápidos con SL/TP ajustados.",
  grid_basket: "Coloca órdenes en niveles equidistantes formando un basket que cierra en conjunto.",
  arbitrage:   "Aprovecha la divergencia de correlación entre dos instrumentos para neutralizar riesgo.",
};

function getNextSlot(usedSlots: number[]): number {
  for (let i = 1; i <= MAX_ALGORITHMS_PER_PLATFORM; i++) {
    if (!usedSlots.includes(i)) return i;
  }
  return -1;
}

function defaultParams(type: AlgoType): AlgoParameters {
  if (type === "scalping")    return { ...DEFAULT_SCALPING_PARAMS };
  if (type === "grid_basket") return { ...DEFAULT_GRID_PARAMS };
  return { ...DEFAULT_ARBITRAGE_PARAMS };
}

export default function AlgorithmWizard({ platform, usedSlots, onClose, onCreated }: Props) {
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);

  // Step 0 state
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [algoType, setAlgoType]     = useState<AlgoType>("scalping");
  const [slotNumber, setSlotNumber] = useState(() => getNextSlot(usedSlots));

  // Step 1 state
  const [params, setParams] = useState<AlgoParameters>(() => defaultParams("scalping"));

  const handleTypeChange = (t: AlgoType) => {
    setAlgoType(t);
    setParams(defaultParams(t));
  };

  const canNext = step === 0 ? name.trim().length > 0 && slotNumber > 0 : true;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/algorithms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, name: name.trim(), description: description.trim() || undefined, algo_type: algoType, parameters: params, slot_number: slotNumber }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Error al crear algoritmo"); return; }
      toast.success(`Algoritmo "${name}" creado en slot #${slotNumber}`);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const typeColor: Record<AlgoType, string> = {
    scalping:    "border-violet-600 bg-violet-950/50",
    grid_basket: "border-cyan-600 bg-cyan-950/50",
    arbitrage:   "border-amber-600 bg-amber-950/50",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Nuevo algoritmo — {platform}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                i < step  ? "bg-emerald-600 border-emerald-500 text-white" :
                i === step ? "bg-slate-700 border-slate-500 text-slate-200" :
                             "bg-slate-900 border-slate-800 text-slate-600"
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-slate-300" : "text-slate-600"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-emerald-700" : "bg-slate-800"}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* STEP 0: Básico */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Nombre del algoritmo *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Gold Scalper v1, Grid XAUUSD M1..."
                  maxLength={80}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Estrategia, condiciones de mercado, notas..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none placeholder:text-slate-600 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo de estrategia *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(["scalping", "grid_basket", "arbitrage"] as AlgoType[]).map((t) => (
                    <button key={t} type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        algoType === t ? typeColor[t] : "border-slate-800 bg-slate-800/50 hover:border-slate-600"
                      }`}
                    >
                      <div className="text-2xl mb-1">{TYPE_ICONS[t]}</div>
                      <div className="text-sm font-semibold text-slate-200">{ALGO_TYPE_LABELS[t]}</div>
                      <div className="text-xs text-slate-500 mt-1 leading-relaxed">{TYPE_DESC[t]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Slot #{slotNumber} — {platform}
                </label>
                <p className="text-xs text-slate-500">Posición en la lista de 50 slots disponibles. Auto-asignado al próximo libre.</p>
                <select
                  value={slotNumber}
                  onChange={(e) => setSlotNumber(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm px-3 py-2 focus:border-slate-500 focus:outline-none"
                >
                  {Array.from({ length: MAX_ALGORITHMS_PER_PLATFORM }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s} disabled={usedSlots.includes(s)}>
                      Slot {s}{usedSlots.includes(s) ? " (ocupado)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 1: Parámetros */}
          {step === 1 && (
            <div>
              <div className={`rounded-xl border px-4 py-2 mb-4 text-xs ${typeColor[algoType]}`}>
                <span className="font-semibold text-slate-200">{ALGO_TYPE_LABELS[algoType]}</span>
                <span className="text-slate-400 ml-2">— Configura los parámetros de tu estrategia</span>
              </div>
              {algoType === "scalping"    && <ScalpingParamsForm   value={params as ScalpingParams}   onChange={setParams} />}
              {algoType === "grid_basket" && <GridParamsForm        value={params as GridBasketParams} onChange={setParams} />}
              {algoType === "arbitrage"   && <ArbitrageParamsForm   value={params as ArbitrageParams}  onChange={setParams} />}
            </div>
          )}

          {/* STEP 2: Revisión */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Algoritmo</span>
                  <span className="text-sm font-semibold text-slate-100">{name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Plataforma</span>
                  <span className="text-sm font-mono text-slate-300">{platform}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Tipo</span>
                  <span className="text-sm text-slate-300">{TYPE_ICONS[algoType]} {ALGO_TYPE_LABELS[algoType]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Slot</span>
                  <span className="text-sm font-mono text-slate-300">#{slotNumber}</span>
                </div>
                {description && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wide block mb-1">Descripción</span>
                    <span className="text-sm text-slate-400">{description}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Parámetros</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(params).map(([k, val]) => {
                    const display = Array.isArray(val) ? (val as string[]).join(", ") || "—" : String(val);
                    return (
                      <div key={k} className="flex justify-between gap-2 py-1 border-b border-slate-800/60 last:border-0">
                        <span className="text-xs text-slate-500 truncate">{k.replace(/_/g, " ")}</span>
                        <span className="text-xs font-mono text-slate-300 truncate">{display}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                El algoritmo se guardará como <span className="text-slate-300 font-semibold">Borrador</span>.
                Podrás iniciarlo en Paper Test desde el panel principal.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-all disabled:opacity-40"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              {saving ? "Guardando..." : <><Check className="w-4 h-4" /> Crear algoritmo</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
