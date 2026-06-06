import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Asset } from "@/lib/news/sources";
import { logError } from "@/lib/log";
import {
  buildCronFromPR,
  normalizeQStashBaseUrl,
  toUtcFromPR,
} from "@/lib/terminal/scheduleHelpers";

const allowedAssets: Asset[] = ["US500", "XAUUSD"];
const QSTASH_BASE_URL = "https://qstash.upstash.io/v2/schedules";

const getRunUrl = () => {
  const base =
    process.env.ALPHALOG_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_HOST;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/terminal/reports/run-scheduled`;
};

const getQStashBaseUrl = () =>
  normalizeQStashBaseUrl(process.env.QSTASH_BASE_URL || QSTASH_BASE_URL);

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
    logError("TerminalReportsSchedule", { component: "terminal.reports.schedule", message: "Error in GET /api/terminal/reports/schedule:", error: error instanceof Error ? error.message : String(error) });
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
      const { data: updatedJob } = await supabase
        .from("terminal_report_jobs")
        .update({ status: "failed", error: "QStash not configured" })
        .eq("id", job.id)
        .select()
        .single();
      return NextResponse.json(
        {
          ok: false,
          job: updatedJob || job,
          status: "failed",
          error: "QStash not configured",
        },
        { status: 200 }
      );
    }

    const payload = {
      job_id: job.id,
      user_id: user.id,
      asset,
    };

    const scheduleAttempts: Array<{
      label: string;
      response: Response | null;
      errorBody?: string;
    }> = [];

    const trySchedule = async (label: string, response: Response) => {
      if (!response.ok) {
        const responseBody = await response.text();
        scheduleAttempts.push({
          label,
          response,
          errorBody: responseBody?.slice(0, 500) || "No response body",
        });
        return null;
      }
      const data = await response.json();
      return data?.scheduleId || data?.id;
    };

    // Preferred: JSON payload to /v2/schedules
    const qstashBase = getQStashBaseUrl();
    const primaryResponse = await fetch(qstashBase, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination: runUrl,
        cron,
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    });

    let scheduleId = await trySchedule("primary", primaryResponse);

    // Fallback: header-based scheduling to /v2/schedules/{url}
    if (!scheduleId) {
      const fallbackResponse = await fetch(
        `${qstashBase}/${encodeURIComponent(runUrl)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Upstash-Cron": cron,
          },
          body: JSON.stringify(payload),
        }
      );
      scheduleId = await trySchedule("fallback", fallbackResponse);
    }

    if (!scheduleId) {
      const lastAttempt = scheduleAttempts[scheduleAttempts.length - 1];
      const status = lastAttempt?.response?.status ?? 500;
      const body = lastAttempt?.errorBody || "Unknown error";
      logError("TerminalReportsSchedule", { component: "terminal.reports.schedule", message: `QStash schedule failed: status=${status}`, status, body });
      const { data: updatedJob } = await supabase
        .from("terminal_report_jobs")
        .update({
          status: "failed",
          error: `QStash schedule failed: ${status} ${body}`,
        })
        .eq("id", job.id)
        .select()
        .single();
      return NextResponse.json(
        {
          ok: false,
          job: updatedJob || job,
          status: "failed",
          error: "Failed to schedule job",
          details: {
            status,
            body,
            attempts: scheduleAttempts.map((attempt) => ({
              label: attempt.label,
              status: attempt.response?.status ?? null,
              body: attempt.errorBody,
            })),
          },
        },
        { status: 200 }
      );
    }

    const { data: updatedJob } = await supabase
      .from("terminal_report_jobs")
      .update({ qstash_schedule_id: scheduleId, error: null })
      .eq("id", job.id)
      .select()
      .single();

    return NextResponse.json({
      ok: true,
      schedule_id: scheduleId,
      status: "pending",
      job_id: job.id,
      job: updatedJob || job,
    });
  } catch (error) {
    logError("TerminalReportsSchedule", { component: "terminal.reports.schedule", message: "Error in POST /api/terminal/reports/schedule:", error: error instanceof Error ? error.message : String(error) });
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
      `${getQStashBaseUrl()}/${job.qstash_schedule_id}`,
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
    logError("TerminalReportsSchedule", { component: "terminal.reports.schedule", message: "Error in DELETE /api/terminal/reports/schedule:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
