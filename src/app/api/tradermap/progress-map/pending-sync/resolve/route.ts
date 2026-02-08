import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recomputeProgress } from "@/lib/tradermap/progressEngine";

/**
 * POST /api/tradermap/progress-map/pending-sync/resolve
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase
      .from("progress_pending_sync")
      .update({ resolved_at: new Date().toISOString() })
      .eq("user_id", userData.user.id)
      .is("resolved_at", null);

    const result = await recomputeProgress(supabase, userData.user.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Error in POST /api/tradermap/progress-map/pending-sync/resolve:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
