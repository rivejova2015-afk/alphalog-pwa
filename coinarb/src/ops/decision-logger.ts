/**
 * Throttled decision logger — writes JSON-line decisions to `coinarb_decisions`
 * keyed by the coinarb agent UUID. Dedicated table, no PolyArb mixing.
 *
 * SKIPs are throttled (default 1/min) so a bored loop running 4 ticks/sec
 * doesn't flood the table. ENTER/EXIT/SCALP/BREAKER are always written.
 */

import { getPg } from '../pg-client.js';

export type DecisionKind = 'ENTER' | 'SCALP' | 'SKIP' | 'EXIT' | 'BREAKER' | 'CASCADE' | 'TICK';
/**
 * Identifier of the parallel strategy that emitted this decision. Keep in
 * sync with `StrategyId` in `trading/spot-positions.ts` — both must list the
 * exact same set of allowed values, since they're the source of truth for
 * `coinarb_*.strategy_id` rows.
 *
 *   'A' — SMC strict          'B' — SMC aggressive
 *   'M' — Mean-reversion      'P' — Momentum-breakout
 */
export type StrategyId = 'A' | 'B' | 'M' | 'P' | 'DD';

export interface DecisionRow {
  agentId: string;
  userId: string;
  kind: DecisionKind;
  symbol?: string;
  venue?: 'spot';
  reason: string;
  meta?: Record<string, unknown>;
  /**
   * Identifier of the parallel strategy that emitted this decision.
   * 'A' = current SMC pipeline, 'B' = aggressive variant (Fase 2+).
   * Optional for backwards compat — DB default is 'A'.
   */
  strategyId?: StrategyId;
}

const SKIP_THROTTLE_MS = 60_000;

export class DecisionLogger {
  private lastSkipAt = 0;

  constructor(private readonly throttleMs: number = SKIP_THROTTLE_MS) {}

  async log(row: DecisionRow): Promise<void> {
    if (row.kind === 'SKIP') {
      const now = Date.now();
      if (now - this.lastSkipAt < this.throttleMs) return;
      this.lastSkipAt = now;
    }

    try {
      const pg = getPg();
      const insertRow: Record<string, unknown> = {
        user_id: row.userId,
        agent_id: row.agentId,
        strategy_id: row.strategyId ?? 'A',
        kind: row.kind,
        symbol: row.symbol ?? null,
        venue: row.venue ?? null,
        reason: row.reason,
        meta: row.meta ?? {},
        created_at: new Date().toISOString(),
      };
      await pg`INSERT INTO coinarb_decisions ${pg(insertRow)}`;
    } catch (err) {
      console.warn('[decision-logger] error:', err instanceof Error ? err.message : String(err));
    }
  }
}
