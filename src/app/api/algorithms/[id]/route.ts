import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  algo_type:   z.enum(["scalping", "grid_basket", "arbitrage"]).optional(),
  status:      z.enum(["draft", "paper", "approved", "live", "paused", "archived"]).optional(),
  parameters:  z.record(z.string(), z.unknown()).optional(),
  slot_number: z.number().int().min(1).max(50).optional(),
});

// GET /api/algorithms/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("trading_algorithms")
      .select(`
        *,
        deployments:algorithm_deployments(*, bot_accounts(label, account_id)),
        backtest:algorithm_backtest_results(*)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      algorithm: {
        ...data,
        backtest: Array.isArray(data.backtest) ? (data.backtest[0] ?? null) : data.backtest,
      },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/algorithms/[id]
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { data, error } = await supabase
      .from("trading_algorithms")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });

    return NextResponse.json({ algorithm: data });
  } catch (err) {
    logError("Algorithms", { component: "PUT /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/algorithms/[id]  (soft-delete)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Stop active deployments first
    await supabase
      .from("algorithm_deployments")
      .update({ status: "stopped", stopped_at: new Date().toISOString() })
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .eq("status", "active");

    const { error } = await supabase
      .from("trading_algorithms")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Algorithms", { component: "DELETE /api/algorithms/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
