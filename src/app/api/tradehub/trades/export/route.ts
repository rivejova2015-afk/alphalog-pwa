// src/app/api/tradehub/trades/export/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decryptText, decryptNumeric } from "@/lib/security/encryption";
import { asString } from "@/lib/validation/nullGuards";

const CSV_HEADERS = [
  "id",
  "symbol",
  "direction",
  "status",
  "entry_date",
  "exit_date",
  "entry_price",
  "exit_price",
  "lots",
  "stop_loss_price",
  "take_profit_price",
  "pnl",
  "pnl_percent",
  "account",
  "setup",
  "notes",
  "created_at",
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(trade: Record<string, unknown>): string {
  return CSV_HEADERS.map((col) => escapeCSV(trade[col])).join(",");
}

/**
 * GET /api/tradehub/trades/export
 * Returns user's trades as a CSV file download.
 * Optional query params: accountId, setupId, range (days or "ytd")
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    const setupId = url.searchParams.get("setupId");
    const range = url.searchParams.get("range");

    let dateFrom: string | null = null;
    if (range && range !== "all") {
      const daysMap: Record<string, number> = { "30": 30, "90": 90, "365": 365 };
      if (range === "ytd") {
        dateFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      } else if (daysMap[range]) {
        const d = new Date();
        d.setDate(d.getDate() - daysMap[range]);
        dateFrom = d.toISOString().slice(0, 10);
      }
    }

    let query = supabase
      .from("trades")
      .select("*, account:accounts(id, name), setup:setups(id, name)")
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("exit_date", { ascending: false });

    if (accountId) query = query.eq("account_id", accountId);
    if (setupId) query = query.eq("setup_id", setupId);
    if (dateFrom) query = query.gte("exit_date", dateFrom);

    const { data, error } = await query;

    if (error) {
      console.error("[export] trades query failed:", error);
      return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
    }

    const rows = (data || []).map((trade: any) => ({
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      status: trade.status,
      entry_date: trade.entry_date,
      exit_date: trade.exit_date ?? "",
      entry_price: decryptNumeric("trades", trade.entry_price_enc, trade.entry_price) ?? "",
      exit_price: decryptNumeric("trades", trade.exit_price_enc, trade.exit_price) ?? "",
      lots: trade.lots,
      stop_loss_price: trade.stop_loss_price ?? "",
      take_profit_price: trade.take_profit_price ?? "",
      pnl: decryptNumeric("trades", trade.pnl_enc, trade.pnl) ?? "",
      pnl_percent: decryptNumeric("trades", trade.pnl_percent_enc, trade.pnl_percent) ?? "",
      account: trade.account?.name ?? "",
      setup: trade.setup?.name ?? "",
      notes: decryptText(asString(trade.notes)),
      created_at: trade.created_at,
    }));

    const csvLines = [
      CSV_HEADERS.join(","),
      ...rows.map(rowToCSV),
    ];
    const csv = csvLines.join("\r\n");

    const filename = `alphalog-trades-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/tradehub/trades/export:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
