import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const backtestSchema = z.object({
  platform:        z.enum(["MT4", "MT5"]),
  period_start:    z.string().optional(),
  period_end:      z.string().optional(),
  total_trades:    z.number().int().nonnegative().optional(),
  win_rate:        z.number().min(0).max(100).optional(),
  profit_factor:   z.number().nonnegative().optional(),
  max_drawdown:    z.number().min(0).max(100).optional(),
  net_profit:      z.number().optional(),
  sharpe_ratio:    z.number().optional(),
  recovery_factor: z.number().optional(),
  raw_data:        z.record(z.string(), z.unknown()).optional(),
});

// POST /api/algorithms/[id]/backtest  — import backtest results
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = backtestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { data: algo } = await supabase
      .from("algorithms")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!algo) return NextResponse.json({ error: "Algoritmo no encontrado" }, { status: 404 });

    const { data, error } = await supabase
      .from("algorithm_backtest_results")
      .insert({ ...parsed.data, user_id: user.id, algorithm_id: id })
      .select()
      .single();

    if (error) {
      logError("Algorithms", { component: "POST backtest", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ backtest: data }, { status: 201 });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/algorithms/[id]/backtest  — list all backtest runs
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("algorithm_backtest_results")
      .select("*")
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
