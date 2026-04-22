import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeCompareTokens } from "@/lib/security/timing";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TTL de caché para el EA: 15 minutos (aligned con la frecuencia de actualización del HMM)
export const revalidate = 900;

function validateBotSignalAuth(request: NextRequest) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const expected = process.env.BOT_SIGNAL_SECRET;
  if (!expected) {
    return { ok: false as const, status: 500, error: "BOT_SIGNAL_SECRET not configured" };
  }
  if (!safeCompareTokens(provided, expected)) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role config");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot/regime/current?botInstanceId=<uuid>
// Llamado por el EA cada 15 minutos para cachear el régimen actual
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // ── Autenticación BOT_SIGNAL_SECRET ────────────────────────────────────
  const auth = validateBotSignalAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const botInstanceId = searchParams.get("botInstanceId");

  if (!botInstanceId) {
    return NextResponse.json(
      { error: "botInstanceId query param is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceClient();

    // ── SELECT último régimen para esta instancia ─────────────────────────
    const { data, error } = await supabase
      .from("bot_regime_states")
      .select(
        "regime_code, confidence, detected_at, strategy_applied, is_cold_start, hmm_state_probs"
      )
      .eq("bot_instance_id", botInstanceId)
      .order("detected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logError("RegimeCurrent", {
        component: "api/bot/regime/current",
        message: error.message,
      });
      throw error;
    }

    // ── Cold start: sin registros previos ─────────────────────────────────
    if (!data) {
      return NextResponse.json(
        {
          regime: "SIDEWAYS_LOW_VOL",
          confidence: 0.5,
          detectedAt: null,
          strategyApplied: "MEAN_REVERSION",
          isColdStart: true,
          stateProbabilities: null,
        },
        {
          status: 200,
          headers: { "Cache-Control": "private, max-age=900, stale-while-revalidate=60" },
        }
      );
    }

    return NextResponse.json(
      {
        regime: data.regime_code,
        confidence: data.confidence,
        detectedAt: data.detected_at,
        strategyApplied: data.strategy_applied,
        isColdStart: data.is_cold_start ?? false,
        stateProbabilities: data.hmm_state_probs ?? null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=900, stale-while-revalidate=60" },
      }
    );
  } catch (error) {
    logError("RegimeCurrent", {
      component: "api/bot/regime/current",
      action: "GET",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
