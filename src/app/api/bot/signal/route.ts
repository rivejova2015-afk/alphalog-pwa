import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError } from "@/lib/log";
import { isSessionActive } from "@/lib/bot/signal-engine/session-guard";
import {
  hestonHamiltonianState,
  quantumWalk,
  quantumAmplitudes,
  combineQuantumSignals,
} from "@/lib/bot/signal-engine/quantum-math";
import { calculatePositionSize } from "@/lib/bot/signal-engine/position-sizer";
import type { RegimeCode } from "@/lib/bot/signal-engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de validación Zod
// ─────────────────────────────────────────────────────────────────────────────

const tickDataSchema = z.object({
  bid: z.number().positive(),
  ask: z.number().positive(),
  last: z.number().positive(),
  volume: z.number().nonnegative(),
  timestamp: z.string().min(1),
});

const recentTradeSchema = z.object({
  pnl: z.number(),
  entry_price: z.number().positive(),
  exit_price: z.number().nonnegative(),
  stop_loss_price: z.number().nonnegative(),
  take_profit_price: z.number().nonnegative(),
  direction: z.enum(["BUY", "SELL"]),
});

const hestonParamsSchema = z.object({
  kappa: z.number().positive(),
  theta: z.number().positive(),
  sigma: z.number().positive(),
  rho: z.number().min(-1).max(1),
  v0: z.number().positive(),
});

const REGIME_CODES = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
] as const;

const signalRequestSchema = z.object({
  botInstanceId: z.string().uuid(),
  tickData: z
    .array(tickDataSchema)
    .min(1, "Se requiere al menos 1 tick")
    .max(100),
  currentEquity: z.number().positive(),
  sessionBaseEquity: z.number().positive(),
  dailyPnlPct: z.number().min(-1).max(1),
  recentTrades: z.array(recentTradeSchema).max(20).default([]),
  currentVol15m: z.number().positive().default(0.01),
  volTarget: z.number().positive().default(0.01),
  stopLossPips: z.number().positive().default(50),
  hestonParams: hestonParamsSchema.optional(),
  regimeCode: z.enum(REGIME_CODES).default("SIDEWAYS_LOW_VOL"),
});

const responseSchema = z.object({
  action: z.enum(["BUY", "SELL", "SKIP"]),
  lots: z.number(),
  confidence: z.number(),
  signalId: z.string(),
  sessionStatus: z.object({
    active: z.boolean(),
    session: z.enum(["NY", "LONDON", "OVERLAP", "CLOSED"]),
    minutesUntilClose: z.number(),
  }),
  blocked: z.boolean(),
  reason: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot/signal
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Guardia de sesión ───────────────────────────────────────────────────
    const sessionStatus = isSessionActive(new Date());

    if (!sessionStatus.active) {
      return NextResponse.json(
        {
          action: "SKIP",
          reason: "SESSION_CLOSED",
          sessionStatus,
          lots: 0,
          confidence: 0,
          signalId: "",
          blocked: false,
        },
        { status: 200 }
      );
    }

    // ── Validación del body ─────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = signalRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      botInstanceId,
      tickData,
      currentEquity,
      sessionBaseEquity,
      dailyPnlPct,
      recentTrades,
      currentVol15m,
      volTarget,
      stopLossPips,
      hestonParams,
      regimeCode,
    } = parsed.data;

    // ── Parámetros de Heston para XAUUSD (defaults conservadores) ──────────
    const params = hestonParams ?? {
      kappa: 1.5,
      theta: 0.04,
      sigma: 0.3,
      rho: -0.5,
      v0: currentVol15m * currentVol15m,
    };

    const priceHistory = tickData.map((t) => t.last);
    const lastTick = tickData[tickData.length - 1];
    const currentPrice = lastTick.last;
    const currentVariance = currentVol15m * currentVol15m;
    const bidAskSpread = lastTick.ask - lastTick.bid;

    // ── Cálculos cuánticos ──────────────────────────────────────────────────
    const hamiltonianState = hestonHamiltonianState(
      currentPrice,
      currentVariance,
      params
    );
    const walkResult = quantumWalk(priceHistory, Math.min(priceHistory.length, 20));
    const amplitudeResult = quantumAmplitudes(
      bidAskSpread,
      lastTick.volume,
      tickData
    );
    const signal = combineQuantumSignals(
      walkResult,
      amplitudeResult,
      hamiltonianState,
      regimeCode as RegimeCode
    );

    // ── Sizing de posición ──────────────────────────────────────────────────
    const position = calculatePositionSize({
      currentEquity,
      sessionBaseEquity,
      dailyPnlPct,
      signal,
      recentTrades,
      currentVol15m,
      volTarget,
      stopLossPips,
    });

    // ── Persistir estado en bot_signal_engine_state ─────────────────────────
    const today = new Date().toISOString().split("T")[0];

    const circuitBroke =
      position.blocked && position.reason === "CIRCUIT_BREAKER_25PCT";

    const { error: upsertError } = await supabase
      .from("bot_signal_engine_state")
      .upsert(
        {
          bot_instance_id: botInstanceId,
          user_id: user.id,
          session_date: today,
          current_equity: currentEquity,
          session_base_equity: sessionBaseEquity,
          daily_pnl_pct: dailyPnlPct,
          ops_count: 1, // incrementado en DB via trigger si se prefiere
          circuit_breaker_triggered: circuitBroke,
          circuit_breaker_at: circuitBroke ? new Date().toISOString() : null,
          circuit_breaker_reason: position.reason ?? null,
          quantum_state: {
            energy: hamiltonianState.energy,
            bullBias: walkResult.bullBias,
            expectedMove: walkResult.expectedMove,
            amplitudes: amplitudeResult.amplitudes,
            signalDirection: signal.action,
            confidence: signal.confidence,
          },
          kelly_current: position.kellyFraction,
          vol_target_current: volTarget,
          regime_code: regimeCode,
        },
        { onConflict: "bot_instance_id,session_date" }
      );

    if (upsertError) {
      logError("SignalEngine", {
        component: "api/bot/signal",
        action: "upsert_state",
        message: upsertError.message,
      });
    }

    // ── Audit log (fire-and-forget) ─────────────────────────────────────────
    logAuditFromRequest(
      {
        userId: user.id,
        action: "bot_signal_generated",
        resourceType: "bot_signal_engine_state",
        status: signal.action === "SKIP" ? "skipped" : "success",
        changes: {
          botInstanceId,
          signalAction: signal.action,
          confidence: signal.confidence,
          lots: position.lots,
          signalId: signal.signalId,
          session: sessionStatus.session,
          regime: regimeCode,
        },
      },
      request
    ).catch(() => undefined);

    // ── Respuesta ───────────────────────────────────────────────────────────
    const responsePayload = {
      action: signal.action,
      lots: position.lots,
      confidence: signal.confidence,
      signalId: signal.signalId,
      sessionStatus,
      blocked: position.blocked,
      ...(position.reason ? { reason: position.reason } : {}),
    };

    const contractResult = enforceResponseContract(responseSchema, responsePayload);
    if (!contractResult.ok) {
      logError("SignalEngine", {
        component: "api/bot/signal",
        action: "contract_guard",
        message: "Response contract violation",
        error: JSON.stringify(contractResult.errors),
      });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    logError("SignalEngine", {
      component: "api/bot/signal",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
