import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { calculateIVSurface, estimateHestonParams } from "@/lib/bot/iv-surface/heston-pricer";
import type { HestonParams } from "@/lib/bot/signal-engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  botInstanceId: z.string().uuid(),
  hestonParams: z
    .object({
      kappa: z.number().positive(),
      theta: z.number().positive(),
      sigma: z.number().positive(),
      rho: z.number().min(-1).max(1),
      v0: z.number().positive(),
    })
    .optional(),
});

const DEFAULT_PARAMS: HestonParams = {
  kappa: 1.5,
  theta: 0.04,
  sigma: 0.3,
  rho: -0.5,
  v0: 0.04,
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot/iv-surface/recalculate
// Fetches latest XAUUSD ticks, estimates Heston params, computes IV surface,
// inserts into iv_surface_snapshots
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { botInstanceId, hestonParams: overrideParams } = parsed.data;

    // ── Fetch recent XAUUSD ticks for param estimation ────────────────────
    const { data: ticks } = await supabase
      .from("live_market_data")
      .select("bid, ask, last")
      .eq("symbol", "XAUUSD")
      .order("received_at", { ascending: false })
      .limit(200);

    const spotPrice =
      ticks && ticks.length > 0 ? Number(ticks[0].last ?? 2000) : 2000;

    const params: HestonParams = overrideParams
      ? overrideParams
      : estimateHestonParams(
          (ticks ?? []).map((t) => ({
            last: Number(t.last),
            bid: Number(t.bid),
            ask: Number(t.ask),
          })),
          DEFAULT_PARAMS
        );

    // ── Compute IV surface (CPU-intensive, ~150ms) ────────────────────────
    const surface = calculateIVSurface(params, spotPrice);

    // ── Insert snapshot ───────────────────────────────────────────────────
    const { data: inserted, error: insertErr } = await supabase
      .from("iv_surface_snapshots")
      .insert({
        user_id: user.id,
        bot_instance_id: botInstanceId,
        instrument: "XAUUSD",
        snapshot_at: surface.computedAt,
        spot_price: spotPrice,
        surface_grid: surface.points,
        strikes: surface.strikes,
        expiries: surface.expiries,
        heston_kappa: params.kappa,
        heston_theta: params.theta,
        heston_sigma: params.sigma,
        heston_rho: params.rho,
        heston_v0: params.v0,
      })
      .select("id, snapshot_at")
      .single();

    if (insertErr) {
      logError("IVSurface", {
        component: "api/bot/iv-surface/recalculate",
        action: "insert",
        message: insertErr.message,
      });
      throw insertErr;
    }

    return NextResponse.json({
      ok: true,
      snapshotId: inserted?.id,
      snapshotAt: inserted?.snapshot_at,
      spotPrice,
      paramsUsed: params,
      pointsComputed: surface.points.length,
    });
  } catch (error) {
    logError("IVSurface", {
      component: "api/bot/iv-surface/recalculate",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
