import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  symbol:      z.string().min(1).max(20),
  direction:   z.enum(["BUY", "SELL"]),
  quantity:    z.number().positive().optional().default(1),
  entry_price: z.number().positive().optional(),
  exit_price:  z.number().positive().optional(),
  pnl:         z.number().optional(),
  status:      z.enum(["open", "closed"]).optional().default("open"),
  source:      z.enum(["signal", "webhook", "manual"]).optional().default("signal"),
  closed_at:   z.string().datetime().optional(),
});

// GET /api/algorithms/[id]/paper-trades
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo } = await supabase
      .from("algorithms")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("algo_paper_trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("algorithm_id", id)
      .order("opened_at", { ascending: false })
      .limit(100);

    if (error) {
      logError("AlgoPaperTrades", { component: "GET /api/algorithms/[id]/paper-trades", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trades: data ?? [] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("AlgoPaperTrades", { component: "GET /api/algorithms/[id]/paper-trades", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/algorithms/[id]/paper-trades
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo } = await supabase
      .from("algorithms")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const rl = await checkAiRateLimit(user.id, "algo-paper-trade", 100);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600), "X-RateLimit-Limit": "100" },
      });
    }

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const { data, error } = await supabase
      .from("algo_paper_trades")
      .insert({
        user_id:     user.id,
        algorithm_id: id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      logError("AlgoPaperTrades", { component: "POST /api/algorithms/[id]/paper-trades", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trade: data }, { status: 201 });
  } catch (err) {
    logError("AlgoPaperTrades", { component: "POST /api/algorithms/[id]/paper-trades", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
