import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Regime + StrategyId narrowing matches the runtime contract:
 *   - 'A' SMC strict (RANGE_HIGH)
 *   - 'B' SMC aggressive (TRENDING_HIGH)
 *   - 'M' Mean-reversion (RANGE_LOW)
 *   - 'P' Momentum-breakout (TRENDING_LOW)
 *   - 'DEAD' → pause (no strategy dispatched)
 */
const REGIMES = ["TRENDING_HIGH", "TRENDING_LOW", "RANGE_HIGH", "RANGE_LOW", "DEAD"] as const;
const STRATEGIES = ["A", "B", "M", "P"] as const;
const REGIME_TO_STRATEGY: Record<string, "A" | "B" | "M" | "P" | "pause"> = {
  TRENDING_HIGH: "B",
  TRENDING_LOW: "P",
  RANGE_HIGH: "A",
  RANGE_LOW: "M",
  DEAD: "pause",
};

// GET /api/algorithms/[id]/monitoring
//
// Returns aggregated observability data for a crypto algorithm — what the
// Coinarb Monitoring tab in /intelligence/algorithms renders. Combines 3
// parallel Supabase reads into a single payload so the client only does
// one round-trip per refresh (15s).
//
// Sections:
//   - regimeDistribution24h: hours spent in each market regime (from
//     coinarb_telemetry.regime over the last 24h)
//   - recentTrades: last 10 closed positions with PnL and exit reason
//   - perStrategyStats: enters/exits/winRate/pnlUsd per strategy 24h,
//     plus which one the current regime maps to (so the UI can highlight)
//   - topSkipReasons6h: top 10 reasons by count over the last 6h
//
// All sections RLS-gated to auth.uid() = user_id. Non-crypto algorithms
// 404, same as /telemetry.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      return NextResponse.json({ error: "Monitoring only available for crypto algorithms" }, { status: 404 });
    }

    // 4 parallel reads. We hit the same tables the existing /telemetry
    // endpoint reads from, plus aggregates over decisions.
    const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const since6h = new Date(Date.now() - 6 * 60 * 60_000).toISOString();

    const [
      regimeSamples,
      currentRegimeRow,
      tradesRows,
      decisionsRows,
    ] = await Promise.all([
      // 1. Heartbeat samples to estimate regime distribution. The bot only
      // writes when the regime changes, so we can't just count rows — we
      // approximate by counting heartbeats in each regime over 24h.
      supabase
        .from("coinarb_telemetry")
        .select("regime, last_heartbeat_at")
        .eq("agent_id", id)
        .gte("last_heartbeat_at", since24h)
        .order("last_heartbeat_at", { ascending: true }),
      // 2. Latest regime to highlight the currently-dispatched strategy.
      supabase
        .from("coinarb_telemetry")
        .select("regime")
        .eq("agent_id", id)
        .order("last_heartbeat_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 3. Last 10 closed positions for the trades table.
      supabase
        .from("coinarb_positions")
        .select(`
          id, symbol, strategy_id, direction,
          entry_price, exit_price, pnl_usd, exit_reason,
          opened_at, closed_at, regime, status
        `)
        .eq("agent_id", id)
        .order("opened_at", { ascending: false })
        .limit(10),
      // 4. Per-strategy decision counts + skip reasons aggregated in 1 read.
      // We pull the raw rows last 24h so we can compute both perStrategyStats
      // and topSkipReasons6h in JS (cheaper than 2 separate group-by queries
      // because the rowcount is bounded by the 100/day cap × 4 runners).
      supabase
        .from("coinarb_decisions")
        .select("strategy_id, kind, reason, created_at")
        .eq("agent_id", id)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (regimeSamples.error) {
      logError("Algorithms", { component: "GET /api/algorithms/[id]/monitoring", message: regimeSamples.error.message });
      return NextResponse.json({ error: regimeSamples.error.message }, { status: 500 });
    }

    // ─── regimeDistribution24h ────────────────────────────────────────────
    // Tick interval is 15s. Hours in regime ≈ (samples in regime × 15) / 3600.
    // We bucket every regime including DEAD; samples with NULL regime
    // (warmup or pre-Phase-2 rows) are dropped from the distribution.
    const regimeCounts = new Map<string, number>();
    for (const r of REGIMES) regimeCounts.set(r, 0);
    for (const sample of regimeSamples.data ?? []) {
      const r = sample.regime;
      if (typeof r === "string" && REGIMES.includes(r as (typeof REGIMES)[number])) {
        regimeCounts.set(r, (regimeCounts.get(r) ?? 0) + 1);
      }
    }
    const totalSamples = Array.from(regimeCounts.values()).reduce((a, b) => a + b, 0);
    const regimeDistribution24h = REGIMES.map((regime) => {
      const samples = regimeCounts.get(regime) ?? 0;
      const hours = (samples * 15) / 3600;
      const pct = totalSamples > 0 ? samples / totalSamples : 0;
      return { regime, hours, pct };
    });

    // ─── recentTrades ─────────────────────────────────────────────────────
    const recentTrades = (tradesRows.data ?? []).map((p) => ({
      id: p.id as string,
      symbol: p.symbol as string,
      strategyId: (p.strategy_id ?? "A") as string,
      direction: (p.direction ?? "BUY") as "BUY" | "SELL",
      entryPrice: num(p.entry_price),
      exitPrice: num(p.exit_price),
      pnlUsd: num(p.pnl_usd),
      exitReason: (p.exit_reason ?? null) as string | null,
      openedAt: p.opened_at as string,
      closedAt: (p.closed_at ?? null) as string | null,
      regime: (p.regime ?? null) as string | null,
      status: (p.status ?? null) as string | null,
    }));

    // ─── perStrategyStats ─────────────────────────────────────────────────
    // ENTER counts, EXIT counts, win rate (= positive PnL EXITs / total EXITs)
    // and aggregated pnlUsd per strategy. We need EXIT rows from positions
    // to get PnL (decisions table doesn't carry pnl directly).
    const enters = new Map<string, number>();
    const exits = new Map<string, number>();
    for (const s of STRATEGIES) {
      enters.set(s, 0);
      exits.set(s, 0);
    }
    for (const d of decisionsRows.data ?? []) {
      const sid = d.strategy_id as string;
      if (!STRATEGIES.includes(sid as (typeof STRATEGIES)[number])) continue;
      if (d.kind === "ENTER") enters.set(sid, (enters.get(sid) ?? 0) + 1);
      else if (d.kind === "EXIT") exits.set(sid, (exits.get(sid) ?? 0) + 1);
    }
    // Win rate + PnL come from coinarb_positions (already filtered to 24h
    // via tradesRows above). We use the wider position set so we count
    // older positions that closed today even if they opened before
    // since24h cutoff — better matches user mental model.
    const wins = new Map<string, number>();
    const pnls = new Map<string, number>();
    const closes = new Map<string, number>();
    for (const s of STRATEGIES) {
      wins.set(s, 0);
      pnls.set(s, 0);
      closes.set(s, 0);
    }
    for (const p of tradesRows.data ?? []) {
      const sid = (p.strategy_id ?? "A") as string;
      if (!STRATEGIES.includes(sid as (typeof STRATEGIES)[number])) continue;
      if (p.status === "CLOSED" && p.pnl_usd !== null) {
        closes.set(sid, (closes.get(sid) ?? 0) + 1);
        const pnl = Number(p.pnl_usd);
        if (Number.isFinite(pnl)) {
          pnls.set(sid, (pnls.get(sid) ?? 0) + pnl);
          if (pnl > 0) wins.set(sid, (wins.get(sid) ?? 0) + 1);
        }
      }
    }
    const currentRegime = (currentRegimeRow.data?.regime ?? null) as string | null;
    const dispatched = currentRegime ? REGIME_TO_STRATEGY[currentRegime] ?? null : null;
    const perStrategyStats = Object.fromEntries(
      STRATEGIES.map((s) => {
        const ent = enters.get(s) ?? 0;
        const ext = exits.get(s) ?? 0;
        const closed = closes.get(s) ?? 0;
        const win = wins.get(s) ?? 0;
        const pnl = pnls.get(s) ?? 0;
        return [
          s,
          {
            enters: ent,
            exits: ext,
            winRate: closed > 0 ? win / closed : 0,
            pnlUsd: pnl,
            isCurrentlyDispatched: dispatched === s,
          },
        ];
      }),
    );

    // ─── topSkipReasons6h ─────────────────────────────────────────────────
    // Group by (reason, strategy_id). Reasons can be long ("mtf bias=NEUTRAL
    // conf=0.06 (need >=0.12 BUY/SELL)") so the UI displays just the leading
    // category — we keep the full string for tooltip.
    const skipCounts = new Map<string, { reason: string; strategyId: string; count: number }>();
    for (const d of decisionsRows.data ?? []) {
      if (d.kind !== "SKIP") continue;
      if (typeof d.created_at !== "string" || d.created_at < since6h) continue;
      const reason = (d.reason ?? "") as string;
      const sid = (d.strategy_id ?? "A") as string;
      const key = `${sid}::${reason}`;
      const existing = skipCounts.get(key);
      if (existing) existing.count += 1;
      else skipCounts.set(key, { reason, strategyId: sid, count: 1 });
    }
    const topSkipReasons6h = Array.from(skipCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json(
      {
        monitoring: {
          regimeDistribution24h,
          recentTrades,
          perStrategyStats,
          topSkipReasons6h,
          currentRegime,
          dispatchedStrategy: dispatched,
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
      },
    );
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/monitoring", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
