// GET/PUT /api/algorithms/alert-preferences — user-configurable alert
// thresholds (Wave 5 item 22, first cut: coinarb-heartbeat only).
//
// GET returns the caller's row, or the cron's hardcoded defaults (300s /
// 30min) if no row exists yet — so the UI always has something sensible to
// show/edit without requiring a pre-seed step.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULTS = {
  coinarb_heartbeat_stale_sec: 300,
  coinarb_heartbeat_dedup_minutes: 30,
};

const updateSchema = z.object({
  coinarb_heartbeat_stale_sec: z.number().int().min(60).max(3600),
  coinarb_heartbeat_dedup_minutes: z.number().int().min(5).max(1440),
});

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("algorithm_alert_preferences")
      .select("coinarb_heartbeat_stale_sec, coinarb_heartbeat_dedup_minutes")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ preferences: data ?? DEFAULTS, isDefault: !data }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/alert-preferences", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { data, error } = await supabase
      .from("algorithm_alert_preferences")
      .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("coinarb_heartbeat_stale_sec, coinarb_heartbeat_dedup_minutes")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ preferences: data });
  } catch (err) {
    logError("Algorithms", { component: "PUT /api/algorithms/alert-preferences", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
