import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import {
  calculatePLMetrics,
  calculateHealthAlerts,
  calculateRunwayMetrics,
  getLastNMonths,
} from "@/lib/business/metrics";
import type { BusinessCost } from "@/lib/business/types";
import type { Trade } from "@/lib/treasury/calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUNWAY_THRESHOLD_MONTHS = Number(process.env.RUNWAY_THRESHOLD_MONTHS ?? 3) || 3;

// GET /api/business/health — produces alerts for negative months + low runway.
// Uses last 3 months of trades + business_costs as input. Cash reserve is
// currently 0 (no external bank integration); runway therefore reflects
// burn-vs-income trend, not absolute solvency.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      logError("BusinessAPI", { component: "GET /api/business/health",
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

    const last3Months = getLastNMonths(3);
    const plLast3 = last3Months.map((m) => calculatePLMetrics(trades, costs, m));
    const runway = calculateRunwayMetrics(plLast3, 0);
    const alerts = calculateHealthAlerts(plLast3, runway.runwayMonths, RUNWAY_THRESHOLD_MONTHS);

    return NextResponse.json(
      { alerts, runway, plLast3 },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/health", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
