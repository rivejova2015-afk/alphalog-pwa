import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const expected = process.env.CRON_SECRET;
    const xCronSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = xCronSecret || bearerToken;
    if (!token || !expected || token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 2);

    const { data: staleJobs } = await supabase
      .from("terminal_report_jobs")
      .select("id")
      .eq("status", "pending")
      .lt("scheduled_for", cutoff.toISOString());

    if (staleJobs && staleJobs.length > 0) {
      await supabase
        .from("terminal_report_jobs")
        .update({
          status: "failed",
          error: "Job expired before execution",
        })
        .in(
          "id",
          staleJobs.map((job) => job.id)
        );
    }

    return NextResponse.json({
      ok: true,
      stale: staleJobs?.length ?? 0,
    });
  } catch (error) {
    console.error("Error in GET /api/terminal/reports/refresh:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
