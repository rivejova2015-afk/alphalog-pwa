import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/algorithms/[id]/telemetry
//
// Returns the latest coinarb_telemetry row for crypto algorithms. The bot
// upserts this row every tick (~15s) so callers get near-real-time state:
// per-symbol trade counts, WS connectivity, last heartbeat, equity, etc.
//
// Non-crypto algorithms return 404 — they have their own telemetry paths
// (MT5 heartbeats, CME connection status) surfaced elsewhere.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ownership + crypto-only check in a single query.
    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, market_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (algoErr || !algo) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }
    if (algo.market_type !== "crypto") {
      return NextResponse.json({ error: "Telemetry only available for crypto algorithms" }, { status: 404 });
    }

    const { data: tele, error: teleErr } = await supabase
      .from("coinarb_telemetry")
      .select(`
        equity_usd,
        available_balance_usd,
        open_positions_count,
        total_pnl_usd,
        win_rate,
        ws_coinbase_connected,
        ws_binance_connected,
        btc_spot_price,
        consecutive_losses,
        daily_trades_count,
        daily_wins,
        daily_losses,
        phase_current,
        risk_pct_current,
        capital_current,
        paused_until,
        last_heartbeat_at,
        payload
      `)
      .eq("agent_id", id)
      .order("last_heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (teleErr) {
      logError("Algorithms", { component: "GET /api/algorithms/[id]/telemetry", message: teleErr.message });
      return NextResponse.json({ error: teleErr.message }, { status: 500 });
    }
    if (!tele) {
      // Bot may not have ticked yet (first-deploy state). Return empty rather than 404
      // so the UI can show a "waiting for first heartbeat" panel cleanly.
      return NextResponse.json({ telemetry: null });
    }

    const payload = (tele.payload ?? {}) as Record<string, unknown>;
    // `regime` is sourced from payload so this endpoint keeps working before
    // the Phase 5 migration adds the dedicated column. Once the column lands
    // and the bot writes to BOTH (payload for runtime introspection, column
    // for analytics queries), the payload read remains the source of truth
    // for this realtime UI.
    const regimeRaw = payload.regime;
    const regime: string | null =
      typeof regimeRaw === "string" &&
      ["TRENDING_HIGH", "TRENDING_LOW", "RANGE_HIGH", "RANGE_LOW", "DEAD"].includes(regimeRaw)
        ? regimeRaw
        : null;
    return NextResponse.json({
      telemetry: {
        equityUsd:            num(tele.equity_usd),
        availableBalanceUsd:  num(tele.available_balance_usd),
        openPositionsCount:   int(tele.open_positions_count),
        totalPnlUsd:          num(tele.total_pnl_usd),
        winRate:              num(tele.win_rate),
        wsCoinbaseConnected:  Boolean(tele.ws_coinbase_connected),
        wsBinanceConnected:   Boolean(tele.ws_binance_connected),
        btcSpotPrice:         num(tele.btc_spot_price),
        consecutiveLosses:    int(tele.consecutive_losses),
        dailyTradesCount:     int(tele.daily_trades_count),
        dailyWins:            int(tele.daily_wins),
        dailyLosses:          int(tele.daily_losses),
        phaseCurrent:         tele.phase_current as string | null,
        riskPctCurrent:       num(tele.risk_pct_current),
        capitalCurrent:       num(tele.capital_current),
        pausedUntil:          tele.paused_until as string | null,
        lastHeartbeatAt:      tele.last_heartbeat_at as string | null,
        tradesBySymbol:       (payload.trades_by_symbol ?? {}) as Record<string, number>,
        totalCap:             int(payload.total_cap) ?? 100,
        perSymbolCap:         int(payload.per_symbol_cap) ?? 33,
        regime,
      },
    }, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/telemetry", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}
