/**
 * POST /api/ops/cron/polyarb-heartbeat
 * Schedule: every 1 minute
 *
 * Checks polyarb_telemetry.last_heartbeat_at for staleness.
 * If stale > 60s for a RUNNING agent, fires push alert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken } from '@/lib/security/timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_SEC = 60;

function validateCronSecret(request: NextRequest) {
  return validateBearerToken(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
    'OPS_CRON_SECRET',
  );
}

export async function POST(request: NextRequest) {
  const auth = validateCronSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status as number });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Missing config' }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Find all RUNNING agents
  const { data: agents, error } = await supabase
    .from('polyarb_agents')
    .select('id, user_id, name, last_heartbeat_at')
    .eq('status', 'RUNNING')
    .is('deleted_at', null);

  if (error || !agents || agents.length === 0) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  const now = Date.now();
  const alerts: string[] = [];

  for (const agent of agents) {
    const lastHb = agent.last_heartbeat_at
      ? new Date(agent.last_heartbeat_at).getTime()
      : 0;
    const ageSec = (now - lastHb) / 1000;

    if (ageSec > STALE_THRESHOLD_SEC) {
      alerts.push(`${agent.name}: stale ${Math.round(ageSec)}s`);

      // Insert circuit breaker event
      await supabase.from('polyarb_circuit_breaker_events').insert({
        user_id: agent.user_id,
        agent_id: agent.id,
        trigger_type: 'HEARTBEAT_STALE',
        severity: ageSec > 300 ? 'S1' : 'S2',
        detail: `Heartbeat stale for ${Math.round(ageSec)}s`,
        equity_at_trigger: null,
        action_taken: 'WARN',
      });

      // Push notification
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alphalog.io';
        await fetch(`${appUrl}/api/push/notify-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: agent.user_id,
            title: `PolyArb: ${agent.name} heartbeat stale`,
            body: `No heartbeat for ${Math.round(ageSec)}s`,
          }),
        });
      } catch {
        // Push failure is non-critical
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked: agents.length,
    alerts,
  });
}
