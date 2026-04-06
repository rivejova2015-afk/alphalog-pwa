/**
 * Compliance Audit Logger — CFTC-ready immutable trail.
 * Writes to polyarb_compliance_audit (append-only).
 */

import { getSupabase } from '../supabase.js';
import type { CircuitBreakerEvent } from '../trading/circuit-breaker.js';

export type ComplianceEventType =
  | 'TRADE_ENTRY'
  | 'TRADE_EXIT'
  | 'CONFIG_CHANGE'
  | 'CIRCUIT_BREAKER'
  | 'AGENT_START'
  | 'AGENT_STOP'
  | 'AGENT_PAUSE'
  | 'AGENT_RESUME'
  | 'POSITION_LIQUIDATED'
  | 'WALLET_FUNDED';

export async function logCompliance(
  agentId: string,
  userId: string,
  eventType: ComplianceEventType,
  entityId?: string,
  entityTable?: string,
  beforeState?: Record<string, unknown>,
  afterState?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('polyarb_compliance_audit')
    .insert({
      user_id: userId,
      agent_id: agentId,
      event_type: eventType,
      entity_id: entityId ?? null,
      entity_table: entityTable ?? null,
      before_state: beforeState ?? null,
      after_state: afterState ?? null,
    });

  if (error) {
    console.error('[compliance] Insert error:', error.message);
  }
}

/**
 * Log circuit breaker events to both tables.
 */
export async function logCircuitBreakerEvents(
  agentId: string,
  userId: string,
  events: CircuitBreakerEvent[]
): Promise<void> {
  if (events.length === 0) return;

  const supabase = getSupabase();

  // Insert into circuit breaker events table
  const cbRows = events.map(e => ({
    user_id: userId,
    agent_id: agentId,
    trigger_type: e.triggerType,
    severity: e.severity,
    detail: e.detail,
    equity_at_trigger: e.equityAtTrigger,
    action_taken: e.actionTaken,
    payload: {},
  }));

  const { error: cbErr } = await supabase
    .from('polyarb_circuit_breaker_events')
    .insert(cbRows);

  if (cbErr) {
    console.error('[compliance] CB events insert error:', cbErr.message);
  }

  // Also log to compliance audit
  for (const e of events) {
    await logCompliance(
      agentId,
      userId,
      'CIRCUIT_BREAKER',
      undefined,
      undefined,
      undefined,
      { triggerType: e.triggerType, severity: e.severity, action: e.actionTaken, detail: e.detail }
    );
  }
}
