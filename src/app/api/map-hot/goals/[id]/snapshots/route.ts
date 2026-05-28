// src/app/api/map-hot/goals/[id]/snapshots/route.ts
// Returns the historical time series of current_value for a single goal.
// Defaults to last 30 days; pass ?days=N to override (max 365).
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

interface SnapshotRow {
  recorded_at: string;
  current_value: string | number;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userIdForBug: string | null = null;
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;
    userIdForBug = userId;

    const daysParam = request.nextUrl.searchParams.get("days");
    const daysRaw = daysParam ? Number(daysParam) : 30;
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 30, 1), 365);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceIso = since.toISOString().slice(0, 10);

    // RLS filters by user_id, but we still enforce ownership on goal_id for clarity
    const { data: goal, error: goalErr } = await supabase
      .from("map_hot_goals")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (goalErr || !goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from("map_hot_goal_snapshots")
      .select("recorded_at, current_value")
      .eq("goal_id", id)
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true });

    if (error) {
      logError("MapHotGoalsSnapshots", { component: "map-hot.goals.[id].snapshots", message: "Error fetching map_hot_goal_snapshots:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to fetch snapshots" }, { status: 500 });
    }

    const points = ((rows ?? []) as unknown as SnapshotRow[]).map((r) => ({
      recorded_at: r.recorded_at,
      current_value: typeof r.current_value === "number" ? r.current_value : Number(r.current_value),
    }));

    return NextResponse.json(
      { goal_id: id, days, points },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err: unknown) {
    logError("MapHotGoalsSnapshots", { component: "map-hot.goals.[id].snapshots", message: "Error in GET /api/map-hot/goals/[id]/snapshots:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
