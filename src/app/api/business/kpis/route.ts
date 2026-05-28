import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { calculateKPIMetrics, getMonthStr } from "@/lib/business/metrics";
import type { BusinessCost } from "@/lib/business/types";
import type { Trade } from "@/lib/treasury/calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/kpis?month=YYYY-MM — computed KPIs for the requested month
// (defaults to current month). Returns consistency, cost-per-trade, profit/hour,
// per-account breakdown — all derived from trades + business_costs.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : getMonthStr();

    const [tradesRes, costsRes] = await Promise.all([
      supabase
        .from("trades")
        .select("id, account_id, entry_date, exit_date, pnl, status")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .ilike("status", "closed"),
      supabase
        .from("business_costs")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null),
    ]);

    if (tradesRes.error || costsRes.error) {
      logError("BusinessAPI", { component: "GET /api/business/kpis",
        message: tradesRes.error?.message ?? costsRes.error?.message ?? "fetch error" });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const trades: Trade[] = (tradesRes.data ?? []).map((t) => ({
      id: t.id as string,
      account_id: t.account_id as string,
      entry_date: (t.entry_date as string) ?? "",
      exit_date: (t.exit_date as string | null) ?? undefined,
      pnl: Number(t.pnl ?? 0),
      status: "Closed",
    }));

    const costs = (costsRes.data ?? []) as BusinessCost[];

    const kpis = calculateKPIMetrics(trades, costs, month);

    return NextResponse.json(
      { kpis },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/kpis", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
