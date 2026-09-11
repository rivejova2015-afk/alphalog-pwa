import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";

/**
 * GET /api/securities/progress
 * Obtiene dashboard de progreso del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: progress, error: progressError } = await db
      .from("securities_progress")
      .select(
        "modules_completed, quiz_scores, exercises_completed, xp_total, streak_days, specialties, badge_ids, career_track_id"
      )
      .eq("user_id", user.id)
      .single();

    if (progressError) {
      throw progressError;
    }

    // Obtener badges ganadas
    const { data: userBadges } = await db
      .from("securities_user_badges")
      .select("badge_id, earned_at")
      .eq("user_id", user.id);

    // Obtener tracks enrollados
    const { data: tracks } = await db
      .from("securities_track_progress")
      .select("track_id, progress_percent, status")
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        progress,
        badges: userBadges || [],
        tracks: tracks || [],
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    logError("CyberSec", "Error fetching progress", {
      component: "api.securities.progress",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
