import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persists the learner's mutable gamification prefs (daily goal) in
// securities_user_state, replacing the previous localStorage-only storage so it
// syncs across devices.
const putSchema = z.object({
  daily_goal: z.number().int().min(10).max(500),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { error } = await supabase
      .from("securities_user_state")
      .upsert({ user_id: user.id, daily_goal: parsed.data.daily_goal, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) {
      logError("Securities", { component: "PUT user-state", message: error.message });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, daily_goal: parsed.data.daily_goal });
  } catch (err) {
    logError("Securities", { component: "PUT user-state", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
