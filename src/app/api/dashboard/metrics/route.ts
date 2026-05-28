// src/app/api/dashboard/metrics/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/lib/dashboard/queries";
import { logError } from "@/lib/log";

/**
 * GET /api/dashboard/metrics
 * Returns performance metrics for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metrics = await getPerformanceMetrics(userData.user.id);

    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err: unknown) {
    logError("DashboardMetrics", { component: "dashboard.metrics", message: "Error in GET /api/dashboard/metrics:", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
