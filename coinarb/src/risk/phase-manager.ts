/**
 * Phase manager: 11-step capital ladder with compounding.
 *
 * After every closed position, recompute current capital and re-evaluate which
 * phase we're in. risk_pct compounds up as capital grows: $100→1%, $1K→2%,
 * $10K→3%, … $5M→15%. Phase transitions get logged to coinarb_phase_log so
 * the dashboard can render the ladder progression.
 */

import { PHASES, type PhaseConfig, COINARB_AGENT_ID, COINARB_USER_ID } from '../core/config.js';
import { getSupabase } from '../supabase.js';

export interface PhaseState {
  phase: PhaseConfig;
  capital: number;
  riskPct: number;
}

export class PhaseManager {
  private current: PhaseConfig;
  private capital: number;

  constructor(initialCapital: number) {
    this.capital = initialCapital;
    this.current = pickPhase(initialCapital);
  }

  get state(): PhaseState {
    return { phase: this.current, capital: this.capital, riskPct: this.current.riskPct };
  }

  get phaseName(): string { return this.current.name; }
  get riskPct(): number { return this.current.riskPct; }
  get capitalNow(): number { return this.capital; }

  /**
   * Recalculate phase after a close. If the phase changed, log the transition.
   * Returns the new phase state.
   */
  async recordClose(newCapital: number): Promise<PhaseState> {
    const prev = this.current;
    this.capital = newCapital;
    const next = pickPhase(newCapital);

    if (next.name !== prev.name) {
      this.current = next;
      await this.logTransition(prev, next, newCapital);
    }

    return this.state;
  }

  private async logTransition(from: PhaseConfig, to: PhaseConfig, capital: number): Promise<void> {
    if (!COINARB_USER_ID) {
      console.warn('[phase-manager] COINARB_USER_ID empty — skipping phase log');
      return;
    }
    try {
      const supabase = getSupabase();
      await supabase.from('coinarb_phase_log').insert({
        user_id: COINARB_USER_ID,
        agent_id: COINARB_AGENT_ID,
        from_phase: from.name,
        to_phase: to.name,
        from_risk_pct: from.riskPct,
        to_risk_pct: to.riskPct,
        capital_at_change: capital,
        reason: to.capitalMin > from.capitalMin ? 'compound_up' : 'compound_down',
        changed_at: new Date().toISOString(),
      });
      console.log(`[phase-manager] ${from.name} → ${to.name} (capital=$${capital.toFixed(2)}, risk=${(to.riskPct * 100).toFixed(2)}%)`);
    } catch (err) {
      console.error('[phase-manager] failed to log transition:', err);
    }
  }
}

/** Pick the highest phase whose capitalMin <= capital */
export function pickPhase(capital: number): PhaseConfig {
  let chosen: PhaseConfig = PHASES[0];
  for (const p of PHASES) {
    if (capital >= p.capitalMin) chosen = p;
    else break;
  }
  return chosen;
}

/** Compute USD risk for a single trade given capital + phase */
export function computeRiskUsd(capital: number, riskPct: number): number {
  return capital * riskPct;
}
