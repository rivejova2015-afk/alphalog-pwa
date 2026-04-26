/**
 * POST /api/health/heartbeat
 * Dead man's switch — called by cron every 15 min.
 * If the app misses 2 consecutive beats (>30 min gap), sends a critical push alert.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeCompareTokens } from "@/lib/security/timing";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_KEY = "deadman:heartbeat";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret") || "";
  const expectedSecret = process.env.CRON_SECRET || "";

  if (!safeCompareTokens(cronSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const now = new Date();

  // Read last heartbeat from api_rate_limits (abuse of key/value store — no new table needed)
  const { data: lastBeat } = await supabase
    .from("api_rate_limits")
    .select("window_start, hits")
    .eq("key", HEARTBEAT_KEY)
    .maybeSingle();

  const lastBeatMs = lastBeat?.window_start ? new Date(lastBeat.window_start).getTime() : 0;
  const gapMs = now.getTime() - lastBeatMs;
  const missed = lastBeatMs > 0 && gapMs > STALE_THRESHOLD_MS;

  // Update heartbeat record
  await supabase.from("api_rate_limits").upsert({
    key: HEARTBEAT_KEY,
    hits: (lastBeat?.hits ?? 0) + 1,
    window_start: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "key" });

  // Send alert if heartbeat was missed
  if (missed) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphalog.io";
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const ownerUserId = process.env.SECURITY_ALERT_USER_ID;

    if (internalSecret && ownerUserId) {
      const gapMin = Math.round(gapMs / 60_000);
      await fetch(`${appUrl}/api/push/notify-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          userId: ownerUserId,
          title: "[ALERTA] AlphaLog heartbeat perdido",
          body: `La app no respondió por ${gapMin} min. Verificar Vercel + bot status.`,
          tag: "deadman-switch",
          data: { type: "heartbeat_missed", gap_minutes: gapMin },
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    ts: now.toISOString(),
    beat: (lastBeat?.hits ?? 0) + 1,
    gap_minutes: lastBeatMs > 0 ? Math.round(gapMs / 60_000) : null,
    alert_sent: missed,
  });
}
