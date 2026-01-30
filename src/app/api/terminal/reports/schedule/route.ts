import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Asset } from "@/lib/news/sources";

const allowedAssets: Asset[] = ["US500", "XAUUSD"];
const QSTASH_BASE_URL = "https://qstash.upstash.io/v2/schedules";

const toUtcFromPR = (datetimePR: string) => {
  const [datePart, timePart] = datetimePR.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    return null;
  }
  // Puerto Rico is UTC-4 year-round.
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute));
};

const buildCronFromPR = (datetimePR: string) => {
  const [datePart, timePart] = datetimePR.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    return null;
  }
  // Cron without year: runs yearly on that date; we'll cancel after first run.
  return `CRON_TZ=America/Puerto_Rico ${minute} ${hour} ${day} ${month} *`;
};

const getRunUrl = () => {
  const base =
    process.env.ALPHALOG_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_HOST;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/terminal/reports/run-scheduled`;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("terminal_report_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error in GET /api/terminal/reports/schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const asset = body?.asset as Asset | "BOTH" | undefined;
    const datetimePR = body?.datetimePR as string | undefined;

    if (!asset || (asset !== "BOTH" && !allowedAssets.includes(asset))) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    if (!datetimePR) {
      return NextResponse.json({ error: "datetimePR is required" }, { status: 400 });
    }

    const scheduledUtc = toUtcFromPR(datetimePR);
    const cron = buildCronFromPR(datetimePR);
    if (!scheduledUtc || !cron) {
      return NextResponse.json({ error: "Invalid datetimePR" }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("terminal_report_jobs")
      .insert({
        user_id: user.id,
        asset,
        scheduled_for: scheduledUtc.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    const token = process.env.QSTASH_TOKEN;
    const runUrl = getRunUrl();
    if (!token || !runUrl) {
      return NextResponse.json(
        { error: "QStash not configured" },
        { status: 500 }
      );
    }

    const scheduleResponse = await fetch(
      `${QSTASH_BASE_URL}/${encodeURIComponent(runUrl)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Upstash-Cron": cron,
        },
        body: JSON.stringify({
          job_id: job.id,
          user_id: user.id,
          asset,
        }),
      }
    );

    if (!scheduleResponse.ok) {
      await supabase
        .from("terminal_report_jobs")
        .update({
          status: "failed",
          error: `QStash schedule failed: ${scheduleResponse.status}`,
        })
        .eq("id", job.id);
      return NextResponse.json(
        { error: "Failed to schedule job" },
        { status: 500 }
      );
    }

    const scheduleData = await scheduleResponse.json();
    const scheduleId = scheduleData?.scheduleId || scheduleData?.id;

    await supabase
      .from("terminal_report_jobs")
      .update({ qstash_schedule_id: scheduleId })
      .eq("id", job.id);

    return NextResponse.json({
      ok: true,
      schedule_id: scheduleId,
      status: "pending",
      job_id: job.id,
    });
  } catch (error) {
    console.error("Error in POST /api/terminal/reports/schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("terminal_report_jobs")
      .select("id, qstash_schedule_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "pending") {
      return NextResponse.json({ error: "Job not pending" }, { status: 400 });
    }

    const token = process.env.QSTASH_TOKEN;
    if (!token || !job.qstash_schedule_id) {
      return NextResponse.json({ error: "QStash not configured" }, { status: 500 });
    }

    const deleteResponse = await fetch(
      `${QSTASH_BASE_URL}/${job.qstash_schedule_id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      return NextResponse.json({ error: "Failed to cancel schedule" }, { status: 500 });
    }

    await supabase
      .from("terminal_report_jobs")
      .update({ status: "cancelled" })
      .eq("id", job.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in DELETE /api/terminal/reports/schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
