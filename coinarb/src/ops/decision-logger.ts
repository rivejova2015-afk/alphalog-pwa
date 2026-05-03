/**
 * Throttled decision logger — writes JSON-line decisions to `coinarb_decisions`
 * keyed by the coinarb agent UUID. Dedicated table, no PolyArb mixing.
 *
 * SKIPs are throttled (default 1/min) so a bored loop running 4 ticks/sec
 * doesn't flood the table. ENTER/EXIT/SCALP/BREAKER are always written.
 */

import { getSupabase } from '../supabase.js';

export type DecisionKind = 'ENTER' | 'SCALP' | 'SKIP' | 'EXIT' | 'BREAKER' | 'CASCADE' | 'TICK';

export interface DecisionRow {
  agentId: string;
  userId: string;
  kind: DecisionKind;
  symbol?: string;
  venue?: 'spot' | 'perp';
  reason: string;
  meta?: Record<string, unknown>;
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
      const supabase = getSupabase();
      const { error } = await supabase.from('coinarb_decisions').insert({
        user_id: row.userId,
        agent_id: row.agentId,
        kind: row.kind,
        symbol: row.symbol ?? null,
        venue: row.venue ?? null,
        reason: row.reason,
        meta: row.meta ?? {},
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.warn('[decision-logger] insert failed:', error.message);
      }
    } catch (err) {
      console.warn('[decision-logger] error:', err instanceof Error ? err.message : String(err));
    }
  }
}
