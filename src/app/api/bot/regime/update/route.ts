import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateBearerToken } from "@/lib/security/timing";
import { logError } from "@/lib/log";
import {
  classifyRegime,
  baumWelch,
  extractFeatures,
  getExpertInitialHMM,
} from "@/lib/bot/regime/hmm-engine";
import type { HMMModel } from "@/lib/bot/regime/hmm-engine";
import type { TickData } from "@/lib/bot/signal-engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mínimo de observaciones para refinar el modelo (24h × 4 ventanas/h)
const MIN_OBS_FOR_BW = 96;

type BotInstanceRow = {
  id: string;
  bot_account_id: string;
  status: string;
  last_heartbeat_at: string | null;
  bot_accounts: { label: string; user_id: string } | { label: string; user_id: string }[] | null;
};

/**
 * The supabase JS client types the `!inner` relation as either an object or
 * an array depending on the codegen path, so normalize. Returns undefined if
 * the join didn't materialize (RLS denial, broken FK, etc.).
 */
function pickJoinedAccount(
  bot_accounts: BotInstanceRow["bot_accounts"],
): { label: string; user_id: string } | undefined {
  if (!bot_accounts) return undefined;
  return Array.isArray(bot_accounts) ? bot_accounts[0] : bot_accounts;
}

/**
 * The HMM model is persisted into a JSONB column. We don't trust it on read:
 * a partially-written row would crash the engine with cryptic NaN errors.
 * If the shape doesn't match we drop it and let the caller cold-start.
 */
function isValidHmmModel(value: unknown): value is HMMModel {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<HMMModel>;
  return (
    Array.isArray(m.A) && m.A.length > 0 && Array.isArray(m.A[0]) &&
    Array.isArray(m.mu) && m.mu.length > 0 && Array.isArray(m.mu[0]) &&
    Array.isArray(m.sigma) && m.sigma.length > 0 && Array.isArray(m.sigma[0]) &&
    Array.isArray(m.pi) && m.pi.length > 0
  );
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
// POST /api/bot/regime/update
// Invocado por QStash cada 15 minutos (lunes-viernes)
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

  try {
    const supabase = getServiceClient();

    // ── 1. Obtener la instancia ACTIVE más reciente ───────────────────────
    const { data: instances, error: instErr } = await supabase
      .from("bot_instances")
      .select(
        "id, bot_account_id, status, last_heartbeat_at, bot_accounts!inner(label, user_id)"
      )
      .eq("status", "ACTIVE")
      .order("last_heartbeat_at", { ascending: false })
      .limit(1);

    if (instErr) throw instErr;

    const instance = instances?.[0];
    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "No active bot instance found" },
        { status: 200 }
      );
    }

    const botInstanceId = instance.id as string;
    const joinedAccount = pickJoinedAccount((instance as BotInstanceRow).bot_accounts);
    if (!joinedAccount?.user_id) {
      logError("RegimeUpdate", {
        component: "api/bot/regime/update",
        action: "owner_resolve",
        message: "bot_accounts join missing user_id — refusing to insert without owner",
        botInstanceId,
      });
      return NextResponse.json(
        { ok: false, error: "Cannot resolve bot owner" },
        { status: 500 },
      );
    }
    const userId = joinedAccount.user_id;

    // ── 2. Obtener ticks de live_market_data (XAUUSD, últimos 1000) ───────
    // live_market_data almacena tick-level: bid, ask, last, received_at, raw_payload
    const { data: marketRows, error: mktErr } = await supabase
      .from("live_market_data")
      .select("bid, ask, last, raw_payload, received_at")
      .eq("symbol", "XAUUSD")
      .order("received_at", { ascending: false })
      .limit(1000);

    if (mktErr) {
      logError("RegimeUpdate", {
        component: "api/bot/regime/update",
        message: mktErr.message,
      });
    }

    const ticks: TickData[] = (marketRows ?? [])
      .filter((r) => r.last != null && r.bid != null && r.ask != null)
      .reverse() // orden cronológico
      .map((r) => ({
        bid: Number(r.bid),
        ask: Number(r.ask),
        last: Number(r.last),
        volume: Number((r.raw_payload as any)?.volume ?? 1),
        timestamp: r.received_at as string,
      }));

    // ── 3. Recuperar modelo HMM almacenado (si existe) ────────────────────
    const today = new Date().toISOString().split("T")[0];
    const { data: stateRow } = await supabase
      .from("bot_signal_engine_state")
      .select("quantum_state")
      .eq("bot_instance_id", botInstanceId)
      .eq("session_date", today)
      .maybeSingle();

    const quantumState =
      stateRow?.quantum_state && typeof stateRow.quantum_state === "object"
        ? (stateRow.quantum_state as Record<string, unknown>)
        : undefined;
    const rawStoredModel = quantumState?.hmm_model;
    const storedModel: HMMModel | undefined = isValidHmmModel(rawStoredModel)
      ? rawStoredModel
      : undefined;

    // ── 4. Clasificar régimen ──────────────────────────────────────────────
    const classification = classifyRegime(ticks, storedModel);

    // ── 5. Refinar modelo si hay suficiente historia ───────────────────────
    let refinedModel = storedModel ?? getExpertInitialHMM();
    let modelRefined = false;

    if (ticks.length >= MIN_OBS_FOR_BW * 4) {
      // Construir serie de FeatureVectors en ventanas de 15 min
      const obsWindows: ReturnType<typeof extractFeatures>[] = [];
      const windowMs = 15 * 60 * 1000;
      if (ticks.length > 0) {
        const firstTs = new Date(ticks[0].timestamp).getTime();
        const lastTs = new Date(ticks[ticks.length - 1].timestamp).getTime();
        for (let t = firstTs; t < lastTs; t += windowMs) {
          const windowTicks = ticks.filter((tk) => {
            const ts = new Date(tk.timestamp).getTime();
            return ts >= t && ts < t + windowMs;
          });
          if (windowTicks.length >= 2) {
            obsWindows.push(extractFeatures(windowTicks));
          }
        }
      }
      if (obsWindows.length >= MIN_OBS_FOR_BW) {
        refinedModel = baumWelch(refinedModel, obsWindows, 5);
        modelRefined = true;
      }
    }

    // ── 6. INSERT en bot_regime_states ────────────────────────────────────
    const prevRegime = storedModel
      ? (quantumState?.signalDirection as string | undefined) ?? null
      : null;
    const regimeChanged = prevRegime !== classification.regime;

    const { error: insertErr } = await supabase
      .from("bot_regime_states")
      .insert({
        bot_instance_id: botInstanceId,
        user_id: userId,
        detected_at: new Date().toISOString(),
        regime_code: classification.regime,
        hmm_state_probs: classification.probabilities,
        hmm_viterbi_path: null, // path completo omitido para ahorrar espacio
        strategy_applied: resolveStrategy(classification.regime),
        confidence: classification.confidence,
        features_snapshot: classification.features,
        is_cold_start: classification.isColdStart,
      });

    if (insertErr) {
      logError("RegimeUpdate", {
        component: "api/bot/regime/update",
        action: "insert_regime",
        message: insertErr.message,
      });
    }

    // ── 7. UPDATE regime_code y hmm_model en bot_signal_engine_state ──────
    const quantumStateUpdate = {
      ...(quantumState ?? {}),
      regime_code: classification.regime,
      regime_confidence: classification.confidence,
      hmm_model: modelRefined ? refinedModel : (storedModel ?? undefined),
    };

    await supabase
      .from("bot_signal_engine_state")
      .upsert(
        {
          bot_instance_id: botInstanceId,
          user_id: userId,
          session_date: today,
          regime_code: classification.regime,
          quantum_state: quantumStateUpdate,
        },
        { onConflict: "bot_instance_id,session_date" }
      );

    return NextResponse.json({
      ok: true,
      regime: classification.regime,
      confidence: classification.confidence,
      changed: regimeChanged,
      isColdStart: classification.isColdStart,
      modelRefined,
      ticksUsed: ticks.length,
    });
  } catch (error) {
    logError("RegimeUpdate", {
      component: "api/bot/regime/update",
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

// Mapeo de régimen a estrategia aplicada por el Signal Engine
function resolveStrategy(regime: string): string {
  switch (regime) {
    case "BULL_TREND_STRONG":
    case "BEAR_TREND_STRONG":
      return "TREND_FOLLOW";
    case "BULL_TREND_WEAK":
    case "BEAR_TREND_WEAK":
      return "WEAK_TREND";
    case "SIDEWAYS_LOW_VOL":
    case "SIDEWAYS_HIGH_VOL":
      return "MEAN_REVERSION";
    case "BREAKOUT_IMMINENT":
      return "BREAKOUT_PREP";
    default:
      return "MEAN_REVERSION";
  }
}
