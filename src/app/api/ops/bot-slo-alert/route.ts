import { NextRequest, NextResponse } from "next/server";
import { captureException, captureMessage } from "@/lib/sentry";
import { safeCompareTokens } from "@/lib/security/timing";
import { logError } from "@/lib/log";

export const runtime = "nodejs";

type BotSloAlertPayload = {
  status?: "PASS" | "DEGRADED" | "FAIL";
  severity?: "NONE" | "S3" | "S2" | "S1";
  generatedAt?: string;
  checks?: unknown;
  byProfile?: unknown;
  recommendedActions?: unknown;
};

function validateToken(request: NextRequest) {
  const provided = request.headers.get("x-ops-token");
  const expected = process.env.OPS_ALERT_TOKEN;

  if (!expected) {
    return { ok: false, status: 500, error: "OPS_ALERT_TOKEN not configured" as const };
  }
  if (!safeCompareTokens(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" as const };
  }
  return { ok: true, status: 200 as const };
}

export async function POST(request: NextRequest) {
  const tokenCheck = validateToken(request);
  if (!tokenCheck.ok) {
    return NextResponse.json({ ok: false, error: tokenCheck.error }, { status: tokenCheck.status });
  }

  let payload: BotSloAlertPayload;
  try {
    payload = (await request.json()) as BotSloAlertPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const status = payload.status ?? "DEGRADED";
  const severity = payload.severity ?? "S2";
  const context = {
    status,
    severity,
    generatedAt: payload.generatedAt ?? null,
    checks: payload.checks ?? [],
    byProfile: payload.byProfile ?? {},
    recommendedActions: payload.recommendedActions ?? [],
    feature: "bot_slo_monitor",
  };

  try {
    if (status === "FAIL" || severity === "S1") {
      const error = new Error(`[BotSLO] Critical alert: ${status} / ${severity}`);
      captureException(error, context);
    } else {
      captureMessage(`[BotSLO] ${status} / ${severity}`, context);
    }
  } catch (error) {
    logError("BotSLOAlert", { component: "ops.bot-slo-alert", message: error instanceof Error ? error.message : String(error) });
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[bot-slo-alert]", context);
  }

  return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
}

