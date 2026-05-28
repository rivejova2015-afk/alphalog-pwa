// src/app/api/algorithms/lite/route.ts
// Lightweight selector endpoint: returns just id+name+status+market_type+platform
// for components like AlgorithmMultiSelect. Cheaper than the full GET.
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return unauthorized();

    const { data, error } = await supabase
      .from("algorithms")
      .select("id, name, status, market_type, platform")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("status", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      logError("AlgorithmsLite", { component: "algorithms.lite", message: "Error fetching algorithms lite:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to fetch algorithms" }, { status: 500 });
    }

    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err: unknown) {
    logError("AlgorithmsLite", { component: "algorithms.lite", message: "Error in GET /api/algorithms/lite:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, { userId: null, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
