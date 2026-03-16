import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recomputeProgress } from "@/lib/tradermap/progressEngine";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

/**
 * GET /api/tradermap/progress-map/state
 * Returns Progress Map state (recomputed)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await recomputeProgress(supabase, userData.user.id);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradermap/progress-map/state:", err);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
