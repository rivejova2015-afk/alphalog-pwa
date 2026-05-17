import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/security/timing";
import { logError } from "@/lib/log";
import { runSkillLearningCycle } from "@/lib/bot/skills/skill-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot/skills/run-cycle
// Cron endpoint: runs skill learning cycle every 24 hours (QStash scheduled)
// Auth: CRON_SECRET bearer token
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── Autenticación CRON_SECRET ───────────────────────────────────────────
  const auth = validateBearerToken(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
    "CRON_SECRET"
  );
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status as number }
    );
  }

  // ── Resolve bot ops user (env first, hard fallback for legacy single-owner) ──
  const userId =
    process.env.BOT_OPS_USER_ID ?? "381e268e-a042-4612-8b39-7a120ace17d6";

  try {
    // ── Run skill learning cycle for XAUUSD ────────────────────────────────
    const result = await runSkillLearningCycle("XAUUSD", userId);

    if (!result.success) {
      // Not necessarily a failure, could be insufficient data
      return NextResponse.json({
        ok: false,
        message: result.error ?? "Learning cycle did not complete",
        tradesProcessed: result.tradesProcessed,
      });
    }

    return NextResponse.json({
      ok: true,
      skillId: result.skillId,
      tradesProcessed: result.tradesProcessed,
      skillVersion: result.skillVersion,
      message: "Skill learning cycle completed successfully",
    });
  } catch (error) {
    logError("SkillRunCycle", {
      component: "api/bot/skills/run-cycle",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
