import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { captureMessageWithModule, captureException } from "@/lib/sentry";
import { safeCompareTokens } from "@/lib/security/timing";

// One-shot verification endpoint used right after setting NEXT_PUBLIC_SENTRY_DSN
// + SENTRY_DSN in Vercel. Fires three events tagged module=smoke-test so they
// land in the Mission Control dashboard's "Errors by Module" widget within
// seconds. Hits the same wrapper path that production logError uses, so a
// successful round-trip proves the whole pipeline (init → tag → upload).
//
// Auth: reuses OPS_ALERT_TOKEN (already required for /api/ops/bot-slo-alert)
// so we don't add a new env var just for a smoke test.
export async function POST(req: Request): Promise<Response> {
  const token = process.env.OPS_ALERT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "OPS_ALERT_TOKEN not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeCompareTokens(bearer, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dsnConfigured = Boolean(process.env.SENTRY_DSN);
  if (!dsnConfigured) {
    return NextResponse.json(
      { ok: false, reason: "SENTRY_DSN unset — Sentry is no-op, nothing sent" },
      { status: 200 }
    );
  }

  captureMessageWithModule("smoke-test", "[SentrySmokeTest] message event", {
    purpose: "verify wrapper path + module tag",
  });

  Sentry.withScope((scope) => {
    scope.setTag("module", "smoke-test");
    scope.setLevel("warning");
    captureException(new Error("SentrySmokeTest: synthetic exception"), {
      purpose: "verify exception path",
    });
  });

  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    sent: ["message", "exception"],
    note: "Open Sentry → Issues, filter tag:module:smoke-test",
  });
}
