import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Regime = "TRENDING_HIGH" | "TRENDING_LOW" | "RANGE_HIGH" | "RANGE_LOW" | "DEAD";
type StrategyId = "A" | "B" | "M" | "P";

// Same mapping as coinarb/src/core/regime-dispatcher.ts — duplicated here
// because the bot lives in its own subproject. If you add a regime/strategy,
// both ends must be updated. The CHECK constraints on coinarb_*.regime /
// strategy_id make the mismatch fail loudly at INSERT time.
const REGIME_TO_STRATEGY: Record<Regime, StrategyId | "pause"> = {
  TRENDING_HIGH: "B",
  TRENDING_LOW: "P",
  RANGE_HIGH: "A",
  RANGE_LOW: "M",
  DEAD: "pause",
};

const STRATEGIES: readonly StrategyId[] = ["A", "B", "M", "P"];

interface RegimeBucket {
  regime: Regime;
  hours: number;
  pct: number;
}
interface RecentTrade {
  id: string;
  symbol: string;
  strategyId: StrategyId | null;
  direction: "BUY" | "SELL";
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  exitReason: string | null;
  openedAt: string;
  closedAt: string | null;
  regime: Regime | null;
}
interface StrategyStat {
  enters: number;
  exits: number;
  winRate: number; // 0–1, 0 when exits === 0
  pnlR: number;    // sum of pnl_usd reframed as R units (1R = $5 in current $20-testing tier)
  isCurrentlyDispatched: boolean;
}
interface SkipReason {
  reason: string;
  count: number;
  strategyId: StrategyId | null;
}

const COINARB_RISK_DOLLARS_PER_R = 5;

/**
 * GET /api/algorithms/[id]/monitoring
 *
 * Aggregated view backing the Coinarb Monitoring tab. Returns 4 datasets in a
 * single roundtrip so the UI can render the dashboard with one fetch:
 *
 *   - regimeDistribution24h: pct of telemetry rows per regime, last 24h
 *   - recentTrades:           last 10 closed positions with PnL + regime
 *   - perStrategyStats:       enters/exits/winRate/pnlR per A/B/M/P
 *                             plus `isCurrentlyDispatched` for the strategy
 *                             that the current regime is mapped to
 *   - topSkipReasons6h:       top SKIP reasons of the last 6h with their count
 *
 * Ownership: `auth.uid() = user_id` on every read via the standard server
 * client (RLS does the filtering — no service role here).
 *
 * Cache-Control: private, 10s, SWR 30s — same cadence as telemetry.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ownership + crypto-only check, same pattern as telemetry route.
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

    // Fan-out 4 queries in parallel. Each one is intentionally narrow
    // (LIMIT or aggregate at SQL level) so the response stays small.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const [telemetryRows, recentPositions, decisionsForStats, skipRows] = await Promise.all([
      // 1. Regime distribution: every heartbeat row tagged with its regime
      // for the last 24h. The bot upserts on (agent_id, strategy_id), so for
      // each tick we get N rows (one per runner) but they all share the same
      // `regime` value (computed once per tick by the coordinator). We dedupe
      // by `last_heartbeat_at` further down so the distribution reflects
      // ticks, not runners-per-tick.
      supabase
        .from("coinarb_telemetry")
        .select("regime, last_heartbeat_at")
        .eq("agent_id", id)
        .gte("last_heartbeat_at", since24h)
        .order("last_heartbeat_at", { ascending: false })
        .limit(10000),

      // 2. Recent closed positions, last 10
      supabase
        .from("coinarb_positions")
        .select("id, symbol, strategy_id, direction, entry_price, exit_price, pnl_usd, exit_reason, opened_at, closed_at, regime, status")
        .eq("agent_id", id)
        .order("opened_at", { ascending: false })
        .limit(10),

      // 3. Decisions for per-strategy stats — only ENTER + EXIT in 24h
      supabase
        .from("coinarb_decisions")
        .select("strategy_id, kind, meta, created_at")
        .eq("agent_id", id)
        .gte("created_at", since24h)
        .in("kind", ["ENTER", "EXIT"])
        .order("created_at", { ascending: false })
        .limit(2000),

      // 4. Top SKIP reasons last 6h. Don't pull payloads — we group by reason
      // string in JS. 6h × 4 ticks/min × 3 symbols × 4 runners = ~17K rows max,
      // but in practice the throttle (1/min per gate) caps it well under that.
      supabase
        .from("coinarb_decisions")
        .select("reason, strategy_id, created_at")
        .eq("agent_id", id)
        .eq("kind", "SKIP")
        .gte("created_at", since6h)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const telemetryError = telemetryRows.error;
    const positionsError = recentPositions.error;
    const decisionsError = decisionsForStats.error;
    const skipError = skipRows.error;

    if (telemetryError || positionsError || decisionsError || skipError) {
      logError("Algorithms", {
        component: "GET /api/algorithms/[id]/monitoring",
        message: "one or more parallel queries failed",
        errors: {
          telemetry: telemetryError?.message,
          positions: positionsError?.message,
          decisions: decisionsError?.message,
          skips: skipError?.message,
        },
      });
      return NextResponse.json({ error: "Monitoring data unavailable" }, { status: 500 });
    }

    const regimeDistribution24h = buildRegimeDistribution(telemetryRows.data ?? []);
    const recentTrades = buildRecentTrades(recentPositions.data ?? []);
    const currentRegime = mostRecentRegime(telemetryRows.data ?? []);
    const perStrategyStats = buildPerStrategyStats(decisionsForStats.data ?? [], currentRegime);
    const topSkipReasons6h = buildTopSkipReasons(skipRows.data ?? []);

    return NextResponse.json(
      {
        regimeDistribution24h,
        recentTrades,
        perStrategyStats,
        topSkipReasons6h,
        currentRegime,
      },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } },
    );
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/monitoring", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Pure builders (no DB, easy to test) ─────────────────────────────────────

type TelRow = { regime: string | null; last_heartbeat_at: string | null };

/**
 * Dedupe telemetry rows by tick (last_heartbeat_at) — the bot writes N rows
 * per tick (one per runner), but the regime is shared across them. Then
 * aggregate by regime → (hours, pct). Hours assumes 15s tick interval.
 *
 * Exported only to make the unit tests self-contained.
 */
export function buildRegimeDistribution(rows: TelRow[]): RegimeBucket[] {
  const seenTicks = new Set<string>();
  const counts: Record<Regime | "UNKNOWN", number> = {
    TRENDING_HIGH: 0, TRENDING_LOW: 0, RANGE_HIGH: 0, RANGE_LOW: 0, DEAD: 0, UNKNOWN: 0,
  };
  for (const row of rows) {
    const tick = row.last_heartbeat_at;
    if (!tick) continue;
    if (seenTicks.has(tick)) continue;
    seenTicks.add(tick);
    const r = (row.regime ?? "UNKNOWN") as Regime | "UNKNOWN";
    if (r in counts) counts[r]++;
    else counts.UNKNOWN++;
  }
  const totalTicks = seenTicks.size;
  if (totalTicks === 0) return [];
  // 15s per tick → seconds / 3600 → hours
  const result: RegimeBucket[] = [];
  for (const regime of ["TRENDING_HIGH", "TRENDING_LOW", "RANGE_HIGH", "RANGE_LOW", "DEAD"] as Regime[]) {
    const ticks = counts[regime];
    if (ticks === 0) continue;
    result.push({
      regime,
      hours: +((ticks * 15) / 3600).toFixed(2),
      pct: +(ticks / totalTicks).toFixed(4),
    });
  }
  // Sort descending by pct so the dominant regime shows first
  return result.sort((a, b) => b.pct - a.pct);
}

type PosRow = {
  id: string;
  symbol: string;
  strategy_id: string | null;
  direction: string;
  entry_price: number | null;
  exit_price: number | null;
  pnl_usd: number | null;
  exit_reason: string | null;
  opened_at: string;
  closed_at: string | null;
  regime: string | null;
  status: string;
};

export function buildRecentTrades(rows: PosRow[]): RecentTrade[] {
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    strategyId: (r.strategy_id as StrategyId | null) ?? null,
    direction: (r.direction === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
    entryPrice: numOrNull(r.entry_price),
    exitPrice: numOrNull(r.exit_price),
    pnlUsd: numOrNull(r.pnl_usd),
    exitReason: r.exit_reason,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    regime: (r.regime as Regime | null) ?? null,
  }));
}

type DecRow = { strategy_id: string | null; kind: string; meta: Record<string, unknown> | null; created_at: string };

export function buildPerStrategyStats(
  rows: DecRow[],
  currentRegime: Regime | null,
): Record<StrategyId, StrategyStat> {
  const init = (): StrategyStat => ({
    enters: 0, exits: 0, winRate: 0, pnlR: 0, isCurrentlyDispatched: false,
  });
  const out: Record<StrategyId, StrategyStat> = {
    A: init(), B: init(), M: init(), P: init(),
  };
  const wins: Record<StrategyId, number> = { A: 0, B: 0, M: 0, P: 0 };

  for (const row of rows) {
    const sid = row.strategy_id as StrategyId | null;
    if (!sid || !(sid in out)) continue;
    if (row.kind === "ENTER") out[sid].enters++;
    if (row.kind === "EXIT") {
      out[sid].exits++;
      const pnl = readMetaNumber(row.meta, "pnlUsd");
      if (pnl !== null) {
        out[sid].pnlR += pnl / COINARB_RISK_DOLLARS_PER_R;
        if (pnl > 0) wins[sid]++;
      }
    }
  }

  for (const sid of STRATEGIES) {
    out[sid].pnlR = +out[sid].pnlR.toFixed(2);
    out[sid].winRate = out[sid].exits > 0 ? +(wins[sid] / out[sid].exits).toFixed(3) : 0;
  }

  const dispatched = currentRegime ? REGIME_TO_STRATEGY[currentRegime] : "pause";
  if (dispatched !== "pause" && dispatched in out) {
    out[dispatched as StrategyId].isCurrentlyDispatched = true;
  }
  return out;
}

type SkipRow = { reason: string; strategy_id: string | null; created_at: string };

export function buildTopSkipReasons(rows: SkipRow[]): SkipReason[] {
  // Normalize reason text — collapse symbol-specific suffixes ("BTC-USD",
  // numeric thresholds) so we group by gate, not by every variant.
  const counts = new Map<string, { count: number; strategyId: StrategyId | null }>();
  for (const row of rows) {
    const key = normalizeSkipReason(row.reason ?? "");
    if (!key) continue;
    const entry = counts.get(key);
    const sid = (row.strategy_id as StrategyId | null) ?? null;
    if (entry) {
      entry.count++;
      // Keep first-seen strategy id; could be improved with majority vote.
      if (!entry.strategyId && sid) entry.strategyId = sid;
    } else {
      counts.set(key, { count: 1, strategyId: sid });
    }
  }
  return Array.from(counts.entries())
    .map(([reason, v]) => ({ reason, count: v.count, strategyId: v.strategyId }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function normalizeSkipReason(raw: string): string {
  // Collapse numeric thresholds in parentheses and trailing symbol tickers.
  // Examples handled:
  //   "mtf bias=BUY conf=0.12 (need >=0.15 BUY/SELL)" → "mtf confidence below floor"
  //   "liquidity-sweep: not detected"                  → "liquidity-sweep: not detected"
  //   "symbol cap reached (17/33)"                     → "symbol cap reached"
  //   "premium-discount: macro=PREMIUM_micro=PREMIUM"  → "premium-discount mismatch"
  const r = raw.trim().toLowerCase();
  if (!r) return "";
  if (r.startsWith("mtf bias=")) return "mtf confidence below floor";
  if (r.startsWith("liquidity-sweep")) return "liquidity-sweep: not detected";
  if (r.startsWith("symbol cap reached")) return "symbol cap reached";
  if (r.startsWith("daily total cap reached")) return "daily total cap reached";
  if (r.startsWith("global daily cap")) return "global daily cap reached";
  if (r.startsWith("global symbol cap")) return "global symbol cap reached";
  if (r.startsWith("premium-discount")) return "premium-discount mismatch";
  if (r.startsWith("warming up")) return "warming up";
  if (r.startsWith("symbol locked")) return "symbol locked by other strategy";
  if (r.startsWith("choch-displacement")) return "choch-displacement gate";
  if (r.startsWith("regime=dead")) return "regime=DEAD → pause";
  // Generic fallback: take first segment before "(" or first 60 chars.
  const parenIdx = r.indexOf("(");
  return (parenIdx > 0 ? r.slice(0, parenIdx) : r).trim().slice(0, 60);
}

function mostRecentRegime(rows: TelRow[]): Regime | null {
  for (const row of rows) {
    if (row.regime && row.regime in REGIME_TO_STRATEGY) return row.regime as Regime;
  }
  return null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readMetaNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const v = meta[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
