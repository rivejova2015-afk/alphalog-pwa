import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_THRESHOLD_SEC = 120;
const ACK_THRESHOLD_SEC = 60;

function validateCronSecret(request: NextRequest) {
  return validateBearerToken(
    request.headers.get("authorization"),
    process.env.OPS_CRON_SECRET,
    "OPS_CRON_SECRET",
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function resolveProfile(name: string): "forex" | "futuros" | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("forex")) return "forex";
  if (n.includes("futuro")) return "futuros";
  return null;
}

function severityLabel(s: string): number {
  return s === "S1" ? 3 : s === "S2" ? 2 : s === "S3" ? 1 : 0;
}

export async function POST(request: NextRequest) {
  const auth = validateCronSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status as number });
  }

  try {
    const supabase = getServiceClient();
    const nowMs = Date.now();

    const [
      { data: bots, error: botsErr },
      { data: instances, error: instancesErr },
      { data: cmdStatus, error: cmdErr },
    ] = await Promise.all([
      supabase.from("bots").select("id,name"),
      supabase.from("bot_instances").select("id,bot_account_id,status,last_heartbeat_at"),
      supabase
        .from("bot_command_status")
        .select("id,bot_account_id,status,created_at,acked_at")
        .eq("status", "PENDING"),
    ]);

    if (botsErr) throw botsErr;
    if (instancesErr) throw instancesErr;
    if (cmdErr) throw cmdErr;

    const checks: { code: string; severity: string; detail: string }[] = [];

    // Heartbeat check
    for (const inst of instances ?? []) {
      if (!inst.last_heartbeat_at) {
        checks.push({ code: "NO_HEARTBEAT", severity: "S2", detail: `Instance ${inst.id} never sent heartbeat` });
        continue;
      }
      const ageSec = (nowMs - new Date(inst.last_heartbeat_at).getTime()) / 1000;
      if (ageSec > HEARTBEAT_THRESHOLD_SEC) {
        const sev = ageSec > 300 ? "S1" : "S2";
        checks.push({ code: "STALE_HEARTBEAT", severity: sev, detail: `Instance ${inst.id} heartbeat ${Math.round(ageSec)}s ago` });
      }
    }

    // Pending command ACK check
    for (const cmd of cmdStatus ?? []) {
      const ageSec = (nowMs - new Date(cmd.created_at).getTime()) / 1000;
      if (ageSec > ACK_THRESHOLD_SEC) {
        checks.push({ code: "COMMAND_UNACKED", severity: "S2", detail: `Command ${cmd.id} pending for ${Math.round(ageSec)}s` });
      }
    }

    // Compute overall severity
    let severity = "NONE";
    for (const c of checks) {
      if (severityLabel(c.severity) > severityLabel(severity)) severity = c.severity;
    }
    const status = severity === "S1" ? "FAIL" : severity === "S2" ? "DEGRADED" : "PASS";

    // Profile breakdown
    const byProfile: Record<string, unknown> = { forex: null, futuros: null };
    for (const bot of bots ?? []) {
      const profile = resolveProfile(bot.name);
      if (!profile) continue;
      byProfile[profile] = { botId: bot.id, severity: "NONE", checks: [] };
    }

    const report = {
      generatedAt: new Date().toISOString(),
      status,
      severity,
      checks,
      byProfile,
      source: "vercel-cron",
    };

    // Dispatch alert if needed
    if (severity === "S1" || severity === "S2") {
      const baseUrl = process.env.ALPHALOG_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/ops/bot-slo-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ops-token": process.env.OPS_ALERT_TOKEN ?? "",
        },
        body: JSON.stringify(report),
      }).catch((err) => console.error("[cron/bot-slo-monitor] alert dispatch failed:", err));
    }

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("[cron/bot-slo-monitor] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
