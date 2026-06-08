import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Asset } from "@/lib/news/sources";
import { runReportPipeline } from "@/lib/reports/runReport";
import { verifyQStashSignature } from "@/lib/qstash/verify";
import { normalizeQStashBaseUrl } from "@/lib/terminal/scheduleHelpers";

const QSTASH_BASE_URL = "https://qstash.upstash.io/v2/schedules";

const getQStashBaseUrl = () =>
  normalizeQStashBaseUrl(process.env.QSTASH_BASE_URL || QSTASH_BASE_URL);

const getRunUrl = () => {
  const base =
    process.env.ALPHALOG_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_HOST;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/terminal/reports/run-scheduled`;
};

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("Upstash-Signature") || "";
  const runUrl = getRunUrl();

  if (!signature || !runUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyQStashSignature(signature, rawBody, runUrl)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { job_id?: string } = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.job_id) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: job, error: jobError } = await supabase
    .from("terminal_report_jobs")
    .select("*")
    .eq("id", payload.job_id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "pending") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const assets: Asset[] =
    job.asset === "BOTH" ? ["US500", "XAUUSD"] : [job.asset];

  const results = await Promise.all(
    assets.map((asset) =>
      runReportPipeline({
        supabase,
        userId: job.user_id,
        asset,
        lookbackDays: 7,
      })
    )
  );

  const anyFailed = results.some((result) => result.outcome === "failed");
  const anyDone = results.some((result) => result.outcome === "done");
  const status = anyFailed ? "failed" : anyDone ? "done" : "done_no_changes";

  await supabase
    .from("terminal_report_jobs")
    .update({
      status,
      outcome: status,
      error: anyFailed ? "One or more assets failed" : null,
    })
    .eq("id", job.id);

  if (job.qstash_schedule_id && process.env.QSTASH_TOKEN) {
    fetch(`${getQStashBaseUrl()}/${job.qstash_schedule_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, status, results });
}
