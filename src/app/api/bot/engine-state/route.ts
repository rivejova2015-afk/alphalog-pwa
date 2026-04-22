import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { isSessionActive } from "@/lib/bot/signal-engine/session-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot/engine-state?botInstanceId=<uuid>
// Returns combined engine state for the EngineDevTools panel (read-only)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const botInstanceId = searchParams.get("botInstanceId");

    if (!botInstanceId) {
      return NextResponse.json(
        { error: "botInstanceId query param is required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Fetch signal engine state + latest regime in parallel
    const [engineResult, regimeResult] = await Promise.all([
      supabase
        .from("bot_signal_engine_state")
        .select(
          "quantum_state, kelly_current, vol_target_current, regime_code, current_equity, session_base_equity, daily_pnl_pct, ops_count, circuit_breaker_triggered, circuit_breaker_at, circuit_breaker_reason, session_date, updated_at"
        )
        .eq("bot_instance_id", botInstanceId)
        .eq("session_date", today)
        .maybeSingle(),
      supabase
        .from("bot_regime_states")
        .select("regime_code, confidence, detected_at, strategy_applied, hmm_state_probs, is_cold_start")
        .eq("bot_instance_id", botInstanceId)
        .order("detected_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (engineResult.error) {
      logError("EngineState", {
        component: "api/bot/engine-state",
        message: engineResult.error.message,
      });
      throw engineResult.error;
    }

    const sessionStatus = isSessionActive(new Date());
    const engineData = engineResult.data;
    const regimeData = regimeResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qs = (engineData?.quantum_state ?? {}) as Record<string, any>;

    return NextResponse.json(
      {
        session: sessionStatus,
        engine: engineData
          ? {
              sessionDate: engineData.session_date,
              updatedAt: engineData.updated_at,
              currentEquity: engineData.current_equity,
              sessionBaseEquity: engineData.session_base_equity,
              dailyPnlPct: engineData.daily_pnl_pct,
              opsCount: engineData.ops_count,
              kellyCurrent: engineData.kelly_current,
              volTarget: engineData.vol_target_current,
              circuitBreakerTriggered: engineData.circuit_breaker_triggered,
              circuitBreakerAt: engineData.circuit_breaker_at,
              circuitBreakerReason: engineData.circuit_breaker_reason,
              regimeCode: engineData.regime_code,
              quantum: {
                energy: qs.energy ?? null,
                bullBias: qs.bullBias ?? null,
                expectedMove: qs.expectedMove ?? null,
                amplitudes: qs.amplitudes ?? null,
                signalDirection: qs.signalDirection ?? null,
                confidence: qs.confidence ?? null,
              },
            }
          : null,
        regime: regimeData
          ? {
              code: regimeData.regime_code,
              confidence: regimeData.confidence,
              detectedAt: regimeData.detected_at,
              strategy: regimeData.strategy_applied,
              stateProbabilities: regimeData.hmm_state_probs,
              isColdStart: regimeData.is_cold_start,
            }
          : null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=5" },
      }
    );
  } catch (error) {
    logError("EngineState", {
      component: "api/bot/engine-state",
      action: "GET",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
