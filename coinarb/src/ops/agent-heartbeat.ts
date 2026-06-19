/**
 * coinarb_agents — legacy heartbeat sync.
 *
 * The bot's source of truth for live state is `coinarb_telemetry` (upserted
 * every 15s in flushTelemetry). The `coinarb_agents` table predates the
 * algorithms-unification (Fase A/B/C) and is still consumed by the
 * `/intelligence/agents` dashboard, which shows OFFLINE if last_heartbeat_at
 * is stale.
 *
 * Until the dashboard migrates to read from `coinarb_telemetry`, we mirror
 * the heartbeat here. We update by user_id (not by id) because the legacy
 * row's UUID predates `algorithms.id` and was never aligned.
 */

export interface AgentHeartbeatPayload {
  status: 'RUNNING' | 'PAUSED';
  last_heartbeat_at: string;
  fly_instance_id: string | null;
}

export function buildAgentHeartbeatPayload(paused: boolean, now: Date = new Date()): AgentHeartbeatPayload {
  return {
    status: paused ? 'PAUSED' : 'RUNNING',
    last_heartbeat_at: now.toISOString(),
    fly_instance_id: process.env.FLY_MACHINE_ID ?? process.env.FLY_ALLOC_ID ?? null,
  };
}

type SupabaseLike = {
  from(table: string): {
    // Supabase returns PostgrestFilterBuilder which is PromiseLike (thenable) but
    // not a true Promise — we accept either so production + test mocks both work.
    update(payload: AgentHeartbeatPayload): {
      eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export async function syncAgentHeartbeat(
  supabase: SupabaseLike,
  userId: string | undefined,
  paused: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: 'no user_id' };
  const payload = buildAgentHeartbeatPayload(paused);
  const { error } = await supabase
    .from('coinarb_agents')
    .update(payload)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
