"use client";

import React, { useState } from "react";
import type { EngineConfig } from "@/lib/validations/engine-config";
import { ENGINE_CONFIG_DEFAULT } from "@/lib/validations/engine-config";

type MarketType = "forex" | "futures" | "options";

interface Props {
  value?: EngineConfig;
  onChange: (config: EngineConfig) => void;
  overrides: Record<string, string>;
  onOverridesChange: (k: string, v: string) => void;
  marketType: MarketType;
}

// ─── UI primitives (replicated to match wizard aesthetic) ────────────────────

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

function NumInput({ value, onChange, step = "any", min = "0", placeholder = "" }: {
  value: string | number; onChange: (v: string) => void; step?: string; min?: string; placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none focus:border-[#475569] placeholder:text-[#2d3748]"
    />
  );
}

function SelectInput({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-sm px-3 py-2 focus:outline-none"
    >
      {children}
    </select>
  );
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-lg border text-xs font-medium transition-all ${
        enabled
          ? "border-[#34d399]/40 bg-[#34d399]/5 text-[#34d399]"
          : "border-[#1f2937] bg-[#0a0e1a] text-[#475569] hover:border-[#2d3748]"
      }`}
    >
      <span className="font-mono uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[10px]">{enabled ? "ENABLED" : "DISABLED"}</span>
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-[#1f2937] pb-2">
      <p className="text-[11px] font-mono font-bold text-[#22d3ee] uppercase tracking-wider">{title}</p>
      {subtitle && <p className="text-[10px] text-[#475569] mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Section 1: Base Engine (read-only) ──────────────────────────────────────

const BASE_TIMEFRAMES: { tf: string; weight: number; role: string }[] = [
  { tf: "D1",  weight: 0.30, role: "trend_liquidity" },
  { tf: "H4",  weight: 0.25, role: "structure_liquidity" },
  { tf: "H1",  weight: 0.20, role: "structure_session" },
  { tf: "M15", weight: 0.15, role: "order_blocks" },
  { tf: "M5",  weight: 0.07, role: "impulse_confirm" },
  { tf: "M1",  weight: 0.03, role: "execution" },
];

function BaseEngineCard() {
  return (
    <div className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono font-bold text-[#34d399] uppercase tracking-wider">Base Engine v1 — Multi-TF</p>
          <p className="text-[10px] text-[#475569] mt-0.5">
            Combina 6 timeframes ponderados. Detecta Order Blocks y Fair Value Gaps para construir bias direccional. Default inamovible.
          </p>
        </div>
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#34d399]/40 bg-[#34d399]/10 text-[#34d399]">
          Siempre activo
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {BASE_TIMEFRAMES.map((t) => (
          <div key={t.tf} className="rounded-lg bg-[#0a0e1a]/80 border border-[#1f2937] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#e2e8f0]">{t.tf}</span>
              <span className="text-[9px] font-mono text-[#34d399]">{(t.weight * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[9px] text-[#475569] mt-0.5 truncate">{t.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module / Overlay row with toggle + collapsible sub-panel ────────────────

function ModuleRow({
  label, description, enabled, onToggle, children,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (b: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {description && (
        <p className="text-[11px] text-[#94a3b8] leading-relaxed px-1">{description}</p>
      )}
      <Toggle enabled={enabled} onChange={onToggle} label={label} />
      {enabled && children && (
        <div className="ml-2 pl-3 border-l border-[#1f2937] space-y-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Section 4: Overrides (variant by market type) ───────────────────────────

function OverridesForex({ overrides, set }: { overrides: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Límite de ops por día" hint="Engine default: 1,200 ops">
        <NumInput value={overrides.daily_op_limit ?? ""} onChange={(v) => set("daily_op_limit", v)} step="100" min="100" placeholder="1200" />
      </Field>
      <Field label="Pérdida diaria máx. (%)" hint="Engine default: 3%">
        <NumInput value={overrides.max_daily_loss_pct ?? ""} onChange={(v) => set("max_daily_loss_pct", v)} step="0.5" min="0.5" placeholder="3.0" />
      </Field>
      <Field label="Posiciones simultáneas máx." hint="Engine default: 5">
        <NumInput value={overrides.max_concurrent ?? ""} onChange={(v) => set("max_concurrent", v)} step="1" min="1" placeholder="5" />
      </Field>
      <Field label="Lotes por leg" hint="Engine default: 0.01">
        <NumInput value={overrides.lot_per_leg ?? ""} onChange={(v) => set("lot_per_leg", v)} step="0.01" min="0.01" placeholder="0.01" />
      </Field>
    </div>
  );
}

function OverridesFutures({ overrides, set }: { overrides: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Contratos por operación" hint="Engine default: 1">
        <NumInput value={overrides.contracts_per_trade ?? ""} onChange={(v) => set("contracts_per_trade", v)} step="1" min="1" placeholder="1" />
      </Field>
      <Field label="Pérdida diaria máx. ($)" hint="Engine default: $500">
        <NumInput value={overrides.max_daily_loss_usd ?? ""} onChange={(v) => set("max_daily_loss_usd", v)} step="100" min="100" placeholder="500" />
      </Field>
      <Field label="Tick tolerance" hint="Ticks adversos antes de salir (default: 4)">
        <NumInput value={overrides.tick_tolerance ?? ""} onChange={(v) => set("tick_tolerance", v)} step="1" min="1" placeholder="4" />
      </Field>
      <Field label="Días antes de rollover" hint="Rotar al siguiente vencimiento (default: 5)">
        <NumInput value={overrides.rollover_days_before ?? ""} onChange={(v) => set("rollover_days_before", v)} step="1" min="1" placeholder="5" />
      </Field>
      <Field label="Límite ops por día" hint="Engine default: 200">
        <NumInput value={overrides.daily_op_limit ?? ""} onChange={(v) => set("daily_op_limit", v)} step="10" min="10" placeholder="200" />
      </Field>
      <Field label="SL × ATR" hint="Dispatcher: SL = ATR(14, M15) × multiplicador. Default 1.5.">
        <NumInput value={overrides.sl_atr_mult ?? ""} onChange={(v) => set("sl_atr_mult", v)} step="0.1" min="0.1" placeholder="1.5" />
      </Field>
      <Field label="TP × ATR" hint="Dispatcher: TP = ATR(14, M15) × multiplicador. Default 3.0 (RR 1:2).">
        <NumInput value={overrides.tp_atr_mult ?? ""} onChange={(v) => set("tp_atr_mult", v)} step="0.1" min="0.1" placeholder="3.0" />
      </Field>
    </div>
  );
}

function OverridesOptions({ overrides, set }: { overrides: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Delta objetivo" hint="Strike selection (default: 0.30)">
        <NumInput value={overrides.target_delta ?? ""} onChange={(v) => set("target_delta", v)} step="0.05" min="0.05" placeholder="0.30" />
      </Field>
      <Field label="IV Rank mínimo (%)" hint="Solo entrar si IV rank >= X (default: 30)">
        <NumInput value={overrides.min_iv_rank ?? ""} onChange={(v) => set("min_iv_rank", v)} step="5" min="5" placeholder="30" />
      </Field>
      <Field label="DTE mínimo" hint="Días a vencimiento mínimo (default: 21)">
        <NumInput value={overrides.min_dte ?? ""} onChange={(v) => set("min_dte", v)} step="1" min="1" placeholder="21" />
      </Field>
      <Field label="DTE máximo" hint="Días a vencimiento máximo (default: 45)">
        <NumInput value={overrides.max_dte ?? ""} onChange={(v) => set("max_dte", v)} step="1" min="1" placeholder="45" />
      </Field>
      <Field label="Contratos máx. por posición" hint="Engine default: 5">
        <NumInput value={overrides.max_contracts ?? ""} onChange={(v) => set("max_contracts", v)} step="1" min="1" placeholder="5" />
      </Field>
      <Field label="Prima máx. $ por contrato" hint="Límite de debit/credit (default: $200)">
        <NumInput value={overrides.max_premium_usd ?? ""} onChange={(v) => set("max_premium_usd", v)} step="25" min="25" placeholder="200" />
      </Field>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AlgorithmWizardStep2(props: Props) {
  const [cfg, setCfg] = useState<EngineConfig>(props.value ?? ENGINE_CONFIG_DEFAULT);

  function commit(next: EngineConfig) {
    setCfg(next);
    props.onChange(next);
  }

  function setModule<K extends keyof EngineConfig["modules"]>(
    key: K,
    patch: Partial<EngineConfig["modules"][K]>,
  ) {
    commit({ ...cfg, modules: { ...cfg.modules, [key]: { ...cfg.modules[key], ...patch } } });
  }

  function setOverlay<K extends keyof EngineConfig["overlays"]>(
    key: K,
    patch: Partial<EngineConfig["overlays"][K]>,
  ) {
    commit({ ...cfg, overlays: { ...cfg.overlays, [key]: { ...cfg.overlays[key], ...patch } } });
  }

  const m = cfg.modules;
  const o = cfg.overlays;

  return (
    <div className="space-y-6">
      {/* Section 1: Base Engine (read-only) */}
      <section className="space-y-3">
        <SectionHeader title="Base Engine" subtitle="Default inamovible — fundamento de toda estrategia" />
        <BaseEngineCard />
      </section>

      {/* Section 2: Engine Modules */}
      <section className="space-y-3">
        <SectionHeader title="Engine Modules" subtitle="Activa los módulos que quieras combinar con el base" />

        <ModuleRow
          label="Capital Phases"
          description="Escala el riesgo % progresivamente a medida que la cuenta crece. Útil para pasar fases de propfirm con tamaño chico al inicio y aumentar cuando el balance sube."
          enabled={m.capital_phases.enabled}
          onToggle={(b) => setModule("capital_phases", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fases" hint="1–11 (default 11)">
              <NumInput value={m.capital_phases.phases} onChange={(v) => setModule("capital_phases", { phases: parseInt(v || "0", 10) })} step="1" min="1" />
            </Field>
            <Field label="Capital inicial ($)" hint="default 100">
              <NumInput value={m.capital_phases.starting_capital} onChange={(v) => setModule("capital_phases", { starting_capital: Number(v || "0") })} step="10" min="1" />
            </Field>
            <Field label="Riesgo mínimo (%)" hint="default 1%">
              <NumInput value={m.capital_phases.risk_min_pct} onChange={(v) => setModule("capital_phases", { risk_min_pct: Number(v || "0") })} step="0.1" min="0.1" />
            </Field>
            <Field label="Riesgo máximo (%)" hint="default 15%">
              <NumInput value={m.capital_phases.risk_max_pct} onChange={(v) => setModule("capital_phases", { risk_max_pct: Number(v || "0") })} step="0.5" min="1" />
            </Field>
          </div>
        </ModuleRow>

        <ModuleRow
          label="Circuit Breaker"
          description="Cierra el bot automáticamente si se cumplen los límites de pérdidas (consecutivas, diaria o semanal). Activá en propfirm para no violar las reglas de drawdown."
          enabled={m.circuit_breaker.enabled}
          onToggle={(b) => setModule("circuit_breaker", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pérdidas consecutivas" hint="default 5">
              <NumInput value={m.circuit_breaker.consecutive_losses} onChange={(v) => setModule("circuit_breaker", { consecutive_losses: parseInt(v || "0", 10) })} step="1" min="1" />
            </Field>
            <Field label="DD diario máx. (%)" hint="default 5%">
              <NumInput value={m.circuit_breaker.daily_dd_pct} onChange={(v) => setModule("circuit_breaker", { daily_dd_pct: Number(v || "0") })} step="0.5" min="1" />
            </Field>
            <Field label="DD semanal máx. (%)" hint="default 10%">
              <NumInput value={m.circuit_breaker.weekly_dd_pct} onChange={(v) => setModule("circuit_breaker", { weekly_dd_pct: Number(v || "0") })} step="0.5" min="1" />
            </Field>
          </div>
        </ModuleRow>

        <ModuleRow
          label="Cascade Probability"
          description="Suma el bias de cada TF ponderado y bloquea entradas si la probabilidad no supera el umbral. Reduce trades ruidosos en zonas mixtas."
          enabled={m.cascade_probability.enabled}
          onToggle={(b) => setModule("cascade_probability", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bias score mínimo" hint="0–100, default 60">
              <NumInput value={m.cascade_probability.min_bias_score} onChange={(v) => setModule("cascade_probability", { min_bias_score: Number(v || "0") })} step="1" min="0" />
            </Field>
            <Field label="Probabilidad mínima" hint="0–1, default 0.65">
              <NumInput value={m.cascade_probability.min_probability} onChange={(v) => setModule("cascade_probability", { min_probability: Number(v || "0") })} step="0.05" min="0" />
            </Field>
          </div>
        </ModuleRow>
      </section>

      {/* Section 3: Overlay Engines */}
      <section className="space-y-3">
        <SectionHeader title="Overlay Engines" subtitle="Capas adicionales — activa solo si las has validado" />

        <ModuleRow
          label="Decision Engine"
          description="Capa adicional que evalúa el score final antes de emitir signal. Usá si querés filtrar más allá del base engine — eleva la barra de calidad."
          enabled={o.decision_engine.enabled}
          onToggle={(b) => setOverlay("decision_engine", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Score mínimo de entrada" hint="default 60">
              <NumInput value={o.decision_engine.decision_score_min} onChange={(v) => setOverlay("decision_engine", { decision_score_min: Number(v || "0") })} step="1" min="0" />
            </Field>
            <Field label="Score base de inicio" hint="default 60">
              <NumInput value={o.decision_engine.decision_base_start} onChange={(v) => setOverlay("decision_engine", { decision_base_start: Number(v || "0") })} step="1" min="0" />
            </Field>
          </div>
        </ModuleRow>

        <ModuleRow
          label="Order Flow"
          description="Detecta sweep de liquidez en niveles equal-high/equal-low. Mejora timing de entrada después de barridos institucionales."
          enabled={o.order_flow.enabled}
          onToggle={(b) => setOverlay("order_flow", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lookback bars" hint="default 10">
              <NumInput value={o.order_flow.sweep_lookback_bars} onChange={(v) => setOverlay("order_flow", { sweep_lookback_bars: parseInt(v || "0", 10) })} step="1" min="1" />
            </Field>
            <Field label="Tolerancia eq. (puntos)" hint="default 20">
              <NumInput value={o.order_flow.eq_tolerance_points} onChange={(v) => setOverlay("order_flow", { eq_tolerance_points: Number(v || "0") })} step="1" min="0" />
            </Field>
          </div>
        </ModuleRow>

        <ModuleRow
          label="Range Gate"
          description="Bloquea trades si el rango actual está fuera de la banda configurada (puntos o ATR). Evita whipsaw en consolidaciones muy chatas o en explosiones de volatilidad."
          enabled={o.range_gate.enabled}
          onToggle={(b) => setOverlay("range_gate", { enabled: b })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modo" hint="RANGE_POINTS o RANGE_ATR">
              <SelectInput value={o.range_gate.range_gate_mode} onChange={(v) => setOverlay("range_gate", { range_gate_mode: v as "RANGE_POINTS" | "RANGE_ATR" })}>
                <option value="RANGE_POINTS">RANGE_POINTS</option>
                <option value="RANGE_ATR">RANGE_ATR</option>
              </SelectInput>
            </Field>
            <div />
            <Field label="Min points" hint="default 0">
              <NumInput value={o.range_gate.range_gate_min_points} onChange={(v) => setOverlay("range_gate", { range_gate_min_points: Number(v || "0") })} step="1" min="0" />
            </Field>
            <Field label="Max points" hint="default 0">
              <NumInput value={o.range_gate.range_gate_max_points} onChange={(v) => setOverlay("range_gate", { range_gate_max_points: Number(v || "0") })} step="1" min="0" />
            </Field>
            <Field label="Min ATR" hint="default 0">
              <NumInput value={o.range_gate.range_gate_min_atr} onChange={(v) => setOverlay("range_gate", { range_gate_min_atr: Number(v || "0") })} step="0.1" min="0" />
            </Field>
            <Field label="Max ATR" hint="default 0">
              <NumInput value={o.range_gate.range_gate_max_atr} onChange={(v) => setOverlay("range_gate", { range_gate_max_atr: Number(v || "0") })} step="0.1" min="0" />
            </Field>
          </div>
        </ModuleRow>

        <ModuleRow label="Pulse Engine" enabled={o.pulse_engine.enabled} onToggle={(b) => setOverlay("pulse_engine", { enabled: b })}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ventana (ms)" hint="default 800">
              <NumInput value={o.pulse_engine.pulse_window_ms} onChange={(v) => setOverlay("pulse_engine", { pulse_window_ms: parseInt(v || "0", 10) })} step="100" min="100" />
            </Field>
            <Field label="Ticks mínimos" hint="default 5">
              <NumInput value={o.pulse_engine.min_pulse_ticks} onChange={(v) => setOverlay("pulse_engine", { min_pulse_ticks: parseInt(v || "0", 10) })} step="1" min="1" />
            </Field>
            <Field label="Skew máx. (puntos)" hint="default 30">
              <NumInput value={o.pulse_engine.max_skew_points} onChange={(v) => setOverlay("pulse_engine", { max_skew_points: Number(v || "0") })} step="1" min="0" />
            </Field>
          </div>
        </ModuleRow>
      </section>

      {/* Section 4: Overrides (variant by market type) */}
      <section className="space-y-3">
        <SectionHeader title="Overrides" subtitle="Los campos vacíos usan los defaults del engine" />
        {props.marketType === "forex"   && <OverridesForex   overrides={props.overrides} set={props.onOverridesChange} />}
        {props.marketType === "futures" && <OverridesFutures overrides={props.overrides} set={props.onOverridesChange} />}
        {props.marketType === "options" && <OverridesOptions overrides={props.overrides} set={props.onOverridesChange} />}
      </section>
    </div>
  );
}
