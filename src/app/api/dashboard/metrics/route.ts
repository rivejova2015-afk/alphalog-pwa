// src/app/api/dashboard/metrics/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPerformanceMetrics } from "@/lib/dashboard/queries";

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
    console.error("Error in GET /api/dashboard/metrics:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
