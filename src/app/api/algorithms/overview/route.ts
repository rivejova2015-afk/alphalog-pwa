// GET /api/algorithms/overview — cross-market P&L/exposure aggregation
// (Wave 5 item 21). Aggregates MT5 + CME; each market's data lives in a
// different table with a different shape:
//   forex   → bot_telemetry (via algorithms.linked_bot_account_id → bot_accounts.id)
//   futures → cme_equity_snapshots + cme_positions (via algorithms.parameters
//             .cme_account_num → algo_cme_accounts.account_number, same
//             resolution path /connections already uses)
//
// "P&L" is intentionally NOT labeled "today" — forex/futures report
// unrealized P&L of currently-open positions, not a daily delta. One
// honest "P&L" label, with per-market breakdown, beats fabricating a false
// "today" number.
//
// Crypto (Coinarb) support was removed 2026-07-14 along with the bot
// itself — coinarb_telemetry no longer exists.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarketBreakdown {
  marketType: "forex" | "futures";
  algorithmCount: number;
  equityUsd: number;
  pnlUsd: number;
  openPositions: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algos, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, market_type, linked_bot_account_id, parameters")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (algoErr) return NextResponse.json({ error: algoErr.message }, { status: 500 });

    const forexAlgos = (algos ?? []).filter((a) => a.market_type === "forex");
    const futuresAlgos = (algos ?? []).filter((a) => a.market_type === "futures");

    // ── Forex ──────────────────────────────────────────────────────────
    const forex: MarketBreakdown = { marketType: "forex", algorithmCount: forexAlgos.length, equityUsd: 0, pnlUsd: 0, openPositions: 0 };
    const botAccountIds = forexAlgos.map((a) => a.linked_bot_account_id).filter((id): id is string => Boolean(id));
    if (botAccountIds.length > 0) {
      const { data: tele } = await supabase
        .from("bot_telemetry")
        .select("equity, balance, positions_total")
        .in("bot_account_id", botAccountIds);
      for (const t of tele ?? []) {
        forex.equityUsd += num(t.equity);
        forex.pnlUsd += num(t.equity) - num(t.balance);
        forex.openPositions += num(t.positions_total);
      }
    }

    // ── Futures ────────────────────────────────────────────────────────
    const futures: MarketBreakdown = { marketType: "futures", algorithmCount: futuresAlgos.length, equityUsd: 0, pnlUsd: 0, openPositions: 0 };
    const cmeAccountNums = futuresAlgos
      .map((a) => (a.parameters as Record<string, unknown> | null)?.cme_account_num)
      .filter((v): v is string => typeof v === "string");
    if (cmeAccountNums.length > 0) {
      const { data: cmeAccounts } = await supabase
        .from("algo_cme_accounts")
        .select("id")
        .eq("user_id", user.id)
        .in("account_number", cmeAccountNums)
        .is("deleted_at", null);
      const cmeAccountIds = (cmeAccounts ?? []).map((a) => a.id as string);
      if (cmeAccountIds.length > 0) {
        const { data: snapshots } = await supabase
          .from("cme_equity_snapshots")
          .select("cme_account_id, equity_usd, snapshot_at")
          .in("cme_account_id", cmeAccountIds)
          .order("snapshot_at", { ascending: false });
        const latestByAccount = new Map<string, number>();
        for (const s of snapshots ?? []) {
          if (!latestByAccount.has(s.cme_account_id as string)) {
            latestByAccount.set(s.cme_account_id as string, num(s.equity_usd));
          }
        }
        for (const equity of latestByAccount.values()) futures.equityUsd += equity;

        const { data: positions } = await supabase
          .from("cme_positions")
          .select("unrealized_pnl_usd")
          .in("cme_account_id", cmeAccountIds);
        for (const p of positions ?? []) {
          futures.pnlUsd += num(p.unrealized_pnl_usd);
          futures.openPositions += 1;
        }
      }
    }

    const byMarket = [forex, futures];
    const totals = byMarket.reduce(
      (acc, m) => ({
        algorithmCount: acc.algorithmCount + m.algorithmCount,
        equityUsd: acc.equityUsd + m.equityUsd,
        pnlUsd: acc.pnlUsd + m.pnlUsd,
        openPositions: acc.openPositions + m.openPositions,
      }),
      { algorithmCount: 0, equityUsd: 0, pnlUsd: 0, openPositions: 0 },
    );

    return NextResponse.json({ totals, byMarket }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/overview", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
