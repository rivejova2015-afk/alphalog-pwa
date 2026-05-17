// src/app/api/cron/map-hot/snapshot/route.ts
// Daily cron: snapshot current_value of every active map_hot_goal so /progress
// can render historical line charts. Idempotent via UNIQUE(goal_id, recorded_at):
// re-running on the same day updates today's value with the latest current_value
// (UPSERT on conflict).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ActiveGoal {
  id: string;
  user_id: string;
  current_value: string | number;
}

function authorize(req: NextRequest): boolean {
  const sent = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!sent || !expected) return false;
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  try {
    const { data: goals, error: fetchErr } = await supabase
      .from("map_hot_goals")
      .select("id, user_id, current_value")
      .is("deleted_at", null);

    if (fetchErr) {
      logError("MapHotSnapshotCron", { component: "fetch_goals", message: fetchErr.message });
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }

    const active = (goals ?? []) as unknown as ActiveGoal[];
    if (active.length === 0) {
      return NextResponse.json({ ok: true, snapshots: 0, date: today });
    }

    const rows = active.map((g) => ({
      user_id: g.user_id,
      goal_id: g.id,
      recorded_at: today,
      current_value: typeof g.current_value === "number" ? g.current_value : Number(g.current_value),
    }));

    const { error: insertErr, count } = await supabase
      .from("map_hot_goal_snapshots")
      .upsert(rows, { onConflict: "goal_id,recorded_at", count: "exact" });

    if (insertErr) {
      logError("MapHotSnapshotCron", { component: "upsert_snapshots", message: insertErr.message });
      return NextResponse.json({ error: "Failed to upsert snapshots" }, { status: 500 });
    }

    logInfo("MapHotSnapshotCron", "snapshots upserted", { snapshots: count ?? rows.length, date: today });
    return NextResponse.json({ ok: true, snapshots: count ?? rows.length, date: today });
  } catch (err: unknown) {
    logError("MapHotSnapshotCron", {
      component: "exception",
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
