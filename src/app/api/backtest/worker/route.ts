import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { verifyQStashSignature } from "@/lib/qstash/verify";
import { runBacktestJob } from "@/lib/backtest/run-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function workerUrl(request: NextRequest): string {
  const base =
    process.env.ALPHALOG_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${request.headers.get("host")}`;
  return `${base.replace(/\/$/, "")}/api/backtest/worker`;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const sig = request.headers.get("upstash-signature") ?? request.headers.get("Upstash-Signature");
  const internalTrigger = request.headers.get("x-internal-trigger") ?? "";
  let authorized = false;

  if (sig) {
    authorized = verifyQStashSignature(sig, rawBody, workerUrl(request));
  } else if (process.env.CRON_SECRET && internalTrigger) {
    authorized = safeCompareTokens(internalTrigger, process.env.CRON_SECRET);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { job_id?: string } = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

  const supabase = createServiceClient();
  await runBacktestJob(supabase, payload.job_id);

  return NextResponse.json({ ok: true, jobId: payload.job_id });
}
