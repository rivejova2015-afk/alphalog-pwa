// Capital phases — scales lot size based on the equity curve relative to the
// configured starting capital. 11 linear phases between risk_min_pct and
// risk_max_pct. When disabled, returns baseLots unchanged.

import type { EngineConfig } from "@/lib/validations/engine-config";

type CapitalPhasesCfg = EngineConfig["modules"]["capital_phases"];

export function phaseForEquity(cfg: CapitalPhasesCfg, equity: number): number {
  if (!cfg.enabled) return 1;
  const startCap = Math.max(1, cfg.starting_capital);
  const ratio = equity / startCap;          // 1.0 = starting, 2.0 = 2x, etc.
  const phases = Math.max(1, cfg.phases);
  // Phase 1 at ratio 1, last phase at ratio 10 (10x the starting capital).
  const span = 9;                            // 10 - 1
  const idx = Math.min(phases, Math.max(1, Math.round(1 + ((ratio - 1) / span) * (phases - 1))));
  return idx;
}

export function lotsForPhase(cfg: CapitalPhasesCfg, equity: number, baseLots: number): number {
  if (!cfg.enabled) return baseLots;
  const phase = phaseForEquity(cfg, equity);
  const phases = Math.max(1, cfg.phases);
  // Linear interpolation between risk_min_pct and risk_max_pct.
  const t = phases > 1 ? (phase - 1) / (phases - 1) : 0;
  const riskPct = cfg.risk_min_pct + t * (cfg.risk_max_pct - cfg.risk_min_pct);
  // baseLots represents the lots at risk_min_pct; scale by the ratio.
  const scale = riskPct / Math.max(0.001, cfg.risk_min_pct);
  const lots = baseLots * scale;
  // Round to 0.01 (forex micro-lot precision).
  return Math.max(0.01, Math.round(lots * 100) / 100);
}
