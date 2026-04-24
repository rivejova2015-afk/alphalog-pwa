import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  platform:    z.enum(["MT4", "MT5"]),
  name:        z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  algo_type:   z.enum(["scalping", "grid_basket", "arbitrage"]),
  parameters:  z.record(z.string(), z.unknown()),
  slot_number: z.number().int().min(1).max(50),
});

// GET /api/algorithms?platform=MT5
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const platform = request.nextUrl.searchParams.get("platform");

    let query = supabase
      .from("trading_algorithms")
      .select(`
        *,
        deployments:algorithm_deployments(
          id, status, deployed_at, bot_account_id,
          bot_accounts(label, account_id)
        ),
        backtest:algorithm_backtest_results(
          id, win_rate, profit_factor, max_drawdown, net_profit,
          sharpe_ratio, total_trades, period_start, period_end, created_at
        )
      `)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("slot_number", { ascending: true });

    if (platform === "MT4" || platform === "MT5") {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query;
    if (error) {
      logError("Algorithms", { component: "GET /api/algorithms", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const algorithms = (data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      backtest: Array.isArray(a.backtest) ? (a.backtest[0] ?? null) : a.backtest,
    }));

    return NextResponse.json({ algorithms }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/algorithms
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { platform, name, description, algo_type, parameters, slot_number } = parsed.data;

    const { data: existing } = await supabase
      .from("trading_algorithms")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("slot_number", slot_number)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) return NextResponse.json({ error: `Slot ${slot_number} ya está ocupado para ${platform}` }, { status: 409 });

    const { count } = await supabase
      .from("trading_algorithms")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("platform", platform)
      .is("deleted_at", null);

    if ((count ?? 0) >= 50) return NextResponse.json({ error: "Límite de 50 algoritmos por plataforma alcanzado" }, { status: 409 });

    const { data, error } = await supabase
      .from("trading_algorithms")
      .insert({ user_id: user.id, platform, name, description, algo_type, parameters, slot_number, sort_index: slot_number })
      .select()
      .single();

    if (error) {
      logError("Algorithms", { component: "POST /api/algorithms", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ algorithm: data }, { status: 201 });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
