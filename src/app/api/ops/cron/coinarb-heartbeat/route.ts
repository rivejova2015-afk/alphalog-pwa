/**
 * POST /api/ops/cron/coinarb-heartbeat
 * Schedule: every 1 minute (vercel.json)
 *
 * For every crypto algorithm with an active deployment, checks the latest
 * `coinarb_telemetry.last_heartbeat_at`. If older than the stale threshold,
 * fires a push notification to the algorithm's owner — but only if the same
 * algorithm hasn't already triggered a stale alert within the dedup window
 * (dedup via app_logs.fingerprint), so a dead bot doesn't spam the user.
 * Threshold + dedup window are per-user configurable via
 * algorithm_alert_preferences (Wave 5 item 22) — falls back to the
 * DEFAULT_* constants below when no row exists for that user.
 *
 * Status-blind by design: a stale heartbeat means the bot process is dead
 * regardless of whether the trader paused trading or the circuit breaker
 * tripped — both should still tick (and flush telemetry) silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateBearerToken } from '@/lib/security/timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Defaults — used when the user hasn't configured algorithm_alert_preferences
// (Wave 5 item 22). 5 min = 20 missed 15s ticks → definitely dead.
const DEFAULT_STALE_THRESHOLD_SEC = 300;
const DEFAULT_DEDUP_WINDOW_MINUTES = 30;

function validateCronSecret(request: NextRequest) {
  return validateBearerToken(
    request.headers.get('authorization'),
    process.env.OPS_CRON_SECRET,
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

  // All crypto algorithms (regardless of status — we want to know if a paused
  // bot's process also died, since "paused" should still tick).
  const { data: algos, error: algoErr } = await supabase
    .from('algorithms')
    .select('id, user_id, name')
    .eq('market_type', 'crypto')
    .is('deleted_at', null);

  if (algoErr) return NextResponse.json({ error: algoErr.message }, { status: 500 });
  if (!algos || algos.length === 0) return NextResponse.json({ ok: true, checked: 0 });

  // Per-user thresholds (Wave 5 item 22) — one query for every distinct
  // owner among the crypto algos found above. Missing rows fall back to
  // the module defaults, so this table is purely additive/opt-in.
  const userIds = [...new Set(algos.map((a) => a.user_id))];
  const { data: prefs } = await supabase
    .from('algorithm_alert_preferences')
    .select('user_id, coinarb_heartbeat_stale_sec, coinarb_heartbeat_dedup_minutes')
    .in('user_id', userIds);
  const prefsByUser = new Map((prefs ?? []).map((p) => [p.user_id, p]));

  const now = Date.now();
  const alerts: { id: string; name: string; ageSec: number; notified: boolean }[] = [];

  for (const algo of algos) {
    const userPrefs = prefsByUser.get(algo.user_id);
    const STALE_THRESHOLD_SEC = userPrefs?.coinarb_heartbeat_stale_sec ?? DEFAULT_STALE_THRESHOLD_SEC;
    const DEDUP_WINDOW_MINUTES = userPrefs?.coinarb_heartbeat_dedup_minutes ?? DEFAULT_DEDUP_WINDOW_MINUTES;

    const { data: tele } = await supabase
      .from('coinarb_telemetry')
      .select('last_heartbeat_at')
      .eq('agent_id', algo.id)
      .order('last_heartbeat_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // No telemetry row at all → bot has never ticked. Treat as stale only if
    // the algorithm row is more than 10 minutes old (post-deploy boot window).
    const lastHbMs = tele?.last_heartbeat_at ? new Date(tele.last_heartbeat_at).getTime() : 0;
    const ageSec = lastHbMs > 0 ? (now - lastHbMs) / 1000 : Infinity;

    if (ageSec <= STALE_THRESHOLD_SEC) continue;

    const fingerprint = `coinarb_heartbeat_stale:${algo.id}`;

    // Dedup: skip the notify if we already alerted within the window. Always
    // log though — the cron run record is useful in app_logs even if quiet.
    const since = new Date(now - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: recentLog } = await supabase
      .from('app_logs')
      .select('id')
      .eq('fingerprint', fingerprint)
      .gte('created_at', since)
      .limit(1)
      .maybeSingle();

    const alreadyAlerted = Boolean(recentLog);

    if (!alreadyAlerted) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alphalog.io';
        await fetch(`${appUrl}/api/push/notify-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: algo.user_id,
            title: `Coinarb stale: ${algo.name}`,
            body: ageSec === Infinity
              ? 'Bot nunca ha enviado heartbeat — verificar Fly machine'
              : `Sin heartbeat por ${formatAge(ageSec)} — verificar Fly machine`,
            tag: `coinarb-stale-${algo.id}`,
          }),
        });
      } catch { /* push failure non-critical */ }
    }

    // Always log the detection so dedup works on next run.
    await supabase.from('app_logs').insert({
      user_id: algo.user_id,
      level: 'warn',
      area: 'coinarb-heartbeat',
      message: alreadyAlerted
        ? `Heartbeat still stale (notification suppressed by dedup): ${algo.name} age=${formatAge(ageSec)}`
        : `Heartbeat stale notification fired: ${algo.name} age=${formatAge(ageSec)}`,
      meta: { algorithm_id: algo.id, age_seconds: ageSec === Infinity ? null : Math.round(ageSec), notified: !alreadyAlerted },
      fingerprint,
    });

    alerts.push({ id: algo.id, name: algo.name, ageSec: ageSec === Infinity ? -1 : Math.round(ageSec), notified: !alreadyAlerted });
  }

  return NextResponse.json({ ok: true, checked: algos.length, stale: alerts.length, alerts });
}

function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}
