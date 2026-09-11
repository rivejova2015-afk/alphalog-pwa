import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

/**
 * GET /api/securities/leaderboard?limit=10
 * Obtiene top usuarios por XP y módulos completados
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const { data: leaderboard, error } = await db
      .from("securities_progress")
      .select("user_id, xp_total, modules_completed, specialties")
      .order("xp_total", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Enriquecer con ranking
    const ranked = (leaderboard || []).map((entry: any, index: number) => ({
      rank: index + 1,
      user_id: entry.user_id,
      xp_total: entry.xp_total || 0,
      modules_completed: (entry.modules_completed || []).length,
      specialties: entry.specialties || [],
      is_current_user: entry.user_id === user.id,
    }));

    // Obtener posición del usuario actual si no está en top
    let userRank = ranked.find((r: any) => r.is_current_user);

    if (!userRank) {
      const { data: userProgress } = await db
        .from("securities_progress")
        .select("xp_total")
        .eq("user_id", user.id)
        .single();

      const { count: betterThan } = await db
        .from("securities_progress")
        .select("*", { count: "exact" })
        .gt("xp_total", userProgress?.xp_total || 0);

      userRank = {
        rank: (betterThan || 0) + 1,
        user_id: user.id,
        xp_total: userProgress?.xp_total || 0,
        modules_completed: 0,
        specialties: [],
        is_current_user: true,
      };
    }

    return NextResponse.json(
      {
        leaderboard: ranked,
        user_rank: userRank,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logError("CyberSec", "Error fetching leaderboard", {
      component: "api.securities.leaderboard",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
