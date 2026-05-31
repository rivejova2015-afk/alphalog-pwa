import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ops/alert-summary?hours=24
// Returns aggregated counts of ops_alert_history rows by job_name + severity
// over the last N hours (default 24, max 168 / 1 week).
//
// Auth: requires an authenticated user (any user). Reads are proxied through
// the service-role client because ops_alert_history is service-role-only RLS
// (migration 113) — it represents system-wide alerts, not user data.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const raw = req.nextUrl.searchParams.get("hours");
    const hours = Math.min(168, Math.max(1, Number(raw ?? "24") || 24));
    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("ops_alert_history")
      .select("job_name, severity, message, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      logError("OpsAlerts", { component: "GET alert-summary", message: error.message });
      return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }

    type Bucket = { job_name: string; severity: string; count: number; last_message: string; last_at: string };
    const buckets = new Map<string, Bucket>();
    for (const row of data ?? []) {
      const key = `${row.job_name}::${row.severity}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        // rows arrive most-recent first, so first message already stored is the latest.
      } else {
        buckets.set(key, {
          job_name: row.job_name,
          severity: row.severity,
          count: 1,
          last_message: row.message,
          last_at: row.created_at,
        });
      }
    }

    return NextResponse.json(
      {
        hours,
        total_events: data?.length ?? 0,
        buckets: Array.from(buckets.values()).sort((a, b) =>
          // critical > error > warning > info, then by count desc
          severityRank(b.severity) - severityRank(a.severity) || b.count - a.count,
        ),
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    logError("OpsAlerts", { component: "GET alert-summary", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function severityRank(s: string): number {
  return s === "critical" ? 3 : s === "error" ? 2 : s === "warning" ? 1 : 0;
}
