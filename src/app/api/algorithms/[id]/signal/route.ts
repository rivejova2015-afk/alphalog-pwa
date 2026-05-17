// Engine signal endpoint — POLL surface for MT4/MT5 EAs.
//
// The EA hits this every few seconds asking "should I trade right now?".
// Phase C: when status is live/running, hands off to the Base Engine v1
// runtime (Multi-TF + cascade + circuit breaker + capital phases). Returns
// HOLD with a non-empty `reason` for paper/paused/draft so the EA never
// receives an actionable signal while not authorized to trade.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { runEngineV1 } from "@/lib/engine/v1";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { SignalResult } from "@/lib/engine/v1/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const signalRequestSchema = z.object({
  bot_account_id: z.string().uuid().optional(),
  symbol:         z.string().min(1).max(20).optional(),
  current_equity: z.number().positive().optional(),
  current_bar:    z.object({
    ts:    z.string().min(1),
    open:  z.number(),
    high:  z.number(),
    low:   z.number(),
    close: z.number(),
  }).optional(),
});

function enabledList<T extends Record<string, { enabled: boolean }>>(group: T | undefined): string[] {
  if (!group) return [];
  return (Object.entries(group) as [string, { enabled: boolean }][])
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
}

// POST /api/algorithms/[id]/signal
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown = {};
    try { body = await request.json(); } catch { /* empty body allowed */ }

    const parsed = signalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, user_id, name, status, platform, engine_config, parameters, instrument, lot_size, risk_percent")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (algoErr || !algo) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }

    // Platform guard — this endpoint is the EA polling path for MT4/MT5 only.
    // Tradovate/IBKR algos are dispatched server-side via cron (see
    // /api/cron/algorithms/tradovate-poll). Returning HOLD here prevents a
    // mis-paired EA from double-firing an order that the dispatcher already
    // owns.
    const platform = (algo as { platform?: string }).platform;
    if (platform && platform !== "MT4" && platform !== "MT5") {
      return NextResponse.json({
        action: "HOLD",
        lots: 0,
        confidence: 0,
        signalId: "",
        reason: `wrong_platform:${platform}_dispatched_server_side`,
        modules: [],
        algorithm: { id: algo.id, name: algo.name, status: algo.status },
      }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }

    const cfg = algo.engine_config as EngineConfig | null;
    const engineInfo = cfg
      ? {
          version: cfg.base_engine?.engine_version ?? "1.0.0",
          available_modules:  enabledList(cfg.modules),
          available_overlays: enabledList(cfg.overlays),
        }
      : null;

    const isLive = algo.status === "live" || algo.status === "running";
    if (!isLive) {
      return NextResponse.json({
        action: "HOLD",
        lots: 0,
        confidence: 0,
        signalId: "",
        reason: `algorithm_status:${algo.status}`,
        modules: [],
        algorithm: { id: algo.id, name: algo.name, status: algo.status },
        engine: engineInfo,
      }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }

    const instruments = Array.isArray(algo.instrument)
      ? (algo.instrument as string[])
      : algo.instrument ? [algo.instrument as string] : [];

    if (instruments.length === 0) {
      return NextResponse.json({
        action: "HOLD",
        lots: 0,
        confidence: 0,
        signalId: "",
        reason: "no_symbol",
        modules: [],
        algorithm: { id: algo.id, name: algo.name, status: algo.status },
        engine: engineInfo,
      }, { status: 200 });
    }

    // Single-symbol path: the EA passed `symbol`, evaluate just that one and
    // return the SignalResult flat (backward-compatible with the existing EA).
    if (parsed.data.symbol) {
      const symbol = parsed.data.symbol;
      try {
        const signal = await runEngineV1(supabase, {
          id:           algo.id as string,
          user_id:      algo.user_id as string,
          name:         algo.name as string,
          status:       algo.status as string,
          engine_config: cfg,
          parameters:   (algo.parameters as Record<string, unknown> | null) ?? null,
          instrument:   instruments,
          lot_size:     algo.lot_size as number | null,
          risk_percent: algo.risk_percent as number | null,
        }, {
          now: new Date(),
          symbol,
          currentEquity: parsed.data.current_equity,
          baseLots: (algo.lot_size as number | null) ?? 0.01,
        });
        return NextResponse.json({
          ...signal,
          algorithm: { id: algo.id, name: algo.name, status: algo.status },
          engine: engineInfo,
        }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
      } catch (engErr) {
        logError("AlgorithmSignal", {
          component: "runEngineV1",
          message: engErr instanceof Error ? engErr.message : String(engErr),
          meta: { algorithm_id: id, symbol },
        });
        return NextResponse.json({
          action: "HOLD",
          lots: 0,
          confidence: 0,
          signalId: "",
          reason: "engine_error",
          modules: [],
          algorithm: { id: algo.id, name: algo.name, status: algo.status },
          engine: engineInfo,
        }, { status: 200 });
      }
    }

    // Multi-symbol path: no `symbol` in body → evaluate ALL instruments of
    // the algorithm in parallel and return an array. The caller picks which
    // to act on (e.g. highest confidence, first BUY, etc.).
    const results = await Promise.all(
      instruments.map(async (sym): Promise<SignalResult & { symbol: string }> => {
        try {
          const sig = await runEngineV1(supabase, {
            id:           algo.id as string,
            user_id:      algo.user_id as string,
            name:         algo.name as string,
            status:       algo.status as string,
            engine_config: cfg,
            parameters:   (algo.parameters as Record<string, unknown> | null) ?? null,
            instrument:   instruments,
            lot_size:     algo.lot_size as number | null,
            risk_percent: algo.risk_percent as number | null,
          }, {
            now: new Date(),
            symbol: sym,
            currentEquity: parsed.data.current_equity,
            baseLots: (algo.lot_size as number | null) ?? 0.01,
          });
          return { ...sig, symbol: sym };
        } catch (engErr) {
          logError("AlgorithmSignal", {
            component: "runEngineV1[multi]",
            message: engErr instanceof Error ? engErr.message : String(engErr),
            meta: { algorithm_id: id, symbol: sym },
          });
          return {
            action: "HOLD",
            lots: 0,
            confidence: 0,
            signalId: "",
            reason: "engine_error",
            modules: [],
            symbol: sym,
          };
        }
      }),
    );

    // Best pick: highest-confidence non-HOLD; otherwise first HOLD.
    const best = [...results].sort((a, b) => {
      if (a.action !== "HOLD" && b.action === "HOLD") return -1;
      if (b.action !== "HOLD" && a.action === "HOLD") return 1;
      return b.confidence - a.confidence;
    })[0];

    return NextResponse.json({
      multi: true,
      best: { ...best, symbol: best.symbol },
      signals: results,
      algorithm: { id: algo.id, name: algo.name, status: algo.status },
      engine: engineInfo,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("AlgorithmSignal", { component: "POST /api/algorithms/[id]/signal", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
