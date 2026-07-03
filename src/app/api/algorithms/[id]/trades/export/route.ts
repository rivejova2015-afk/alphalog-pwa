// GET /api/algorithms/[id]/trades/export — CSV export of an algorithm's
// trade history (Wave 5 item 24).
//
// CSV only, not PDF: this repo already tried @react-pdf/renderer for a
// report export and reverted it (see src/lib/polyarb/archive.tsx header —
// "@react-pdf/renderer 3.4.5 throws `Cannot read properties of undefined
// (reading 'hasOwnProperty')` against React 19 internals"). Re-introducing
// PDF generation here would hit the same documented, unresolved bug.
//
// Branches by market_type since trade history lives in a different table
// per market — there's no unified "algorithm trades" table:
//   forex   → algorithm_trades (algorithm_id)
//   crypto  → coinarb_positions (agent_id — algorithms.id IS the agent id
//             for the coinarb-50x singleton, see migration 099)
//   futures → algo_cme_accounts (resolved via parameters.cme_account_num,
//             same lookup /connections already does) → account_type decides
//             cme_trades_propfirm vs cme_trades_real (cme_account_id)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCSV(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, market_type, parameters")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    let headers: string[];
    let rows: Record<string, unknown>[];

    if (algo.market_type === "forex") {
      headers = ["id", "direction", "instrument", "entry_price", "exit_price", "lots", "duration_min", "pnl", "status", "opened_at", "closed_at"];
      const { data, error } = await supabase
        .from("algorithm_trades")
        .select(headers.join(","))
        .eq("algorithm_id", id)
        .eq("user_id", user.id)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      rows = (data ?? []) as unknown as Record<string, unknown>[];
    } else if (algo.market_type === "crypto") {
      headers = ["id", "symbol", "direction", "entry_price", "exit_price", "size_usd", "pnl_usd", "pnl_percent", "status", "exit_reason", "opened_at", "closed_at"];
      const { data, error } = await supabase
        .from("coinarb_positions")
        .select(headers.join(","))
        .eq("agent_id", id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = (data ?? []) as unknown as Record<string, unknown>[];
    } else if (algo.market_type === "futures") {
      const params2 = (algo.parameters ?? {}) as Record<string, unknown>;
      const cmeAccountNum = typeof params2.cme_account_num === "string" ? params2.cme_account_num : null;
      headers = ["id", "contract", "direction", "quantity", "fill_price", "status", "pnl_usd", "commission_usd", "slippage_ticks", "close_reason", "fill_timestamp"];
      rows = [];
      if (cmeAccountNum) {
        const { data: cmeAcc } = await supabase
          .from("algo_cme_accounts")
          .select("id, account_type")
          .eq("user_id", user.id)
          .eq("account_number", cmeAccountNum)
          .is("deleted_at", null)
          .maybeSingle();
        if (cmeAcc) {
          const table = cmeAcc.account_type === "propfirm" ? "cme_trades_propfirm" : "cme_trades_real";
          const { data, error } = await supabase
            .from(table)
            .select(headers.join(","))
            .eq("cme_account_id", cmeAcc.id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (error) throw error;
          rows = (data ?? []) as unknown as Record<string, unknown>[];
        }
      }
    } else {
      return NextResponse.json({ error: `Export not supported for market_type=${algo.market_type}` }, { status: 400 });
    }

    const csv = toCSV(headers, rows);
    const filename = `${(algo.name as string).replace(/[^a-z0-9-]+/gi, "_")}-trades.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/trades/export", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
