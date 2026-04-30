import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const parametersSchema = z.object({
  lot_size:         z.number().min(0.01).max(100).optional(),
  stop_loss_pips:   z.number().int().min(1).max(10000).optional(),
  take_profit_pips: z.number().int().min(1).max(10000).optional(),
  max_trades:       z.number().int().min(1).max(100).optional(),
  risk_percent:     z.number().min(0).max(100).optional(),
}).passthrough();

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  instrument: z.string().min(1).max(40).optional(),
  status:     z.enum(["running", "stopped", "paused", "error"]).optional(),
  parameters: parametersSchema.optional(),
});

const KNOWN_PARAM_COLUMNS = ["lot_size", "stop_loss_pips", "take_profit_pips", "max_trades", "risk_percent"] as const;

function buildUpdatePayload(parsed: z.infer<typeof updateSchema>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (parsed.name !== undefined) payload.name = parsed.name;
  if (parsed.instrument !== undefined) payload.instrument = parsed.instrument;
  if (parsed.status !== undefined) payload.status = parsed.status;
  if (parsed.parameters) {
    for (const key of KNOWN_PARAM_COLUMNS) {
      const value = parsed.parameters[key];
      if (value !== undefined) payload[key] = value;
    }
  }
  return payload;
}

// GET /api/algorithms/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("algorithms")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ algorithm: data });
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

    const payload = buildUpdatePayload(parsed.data);
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("algorithms")
      .update(payload)
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

    const { error } = await supabase
      .from("algorithms")
      .update({ deleted_at: new Date().toISOString(), status: "stopped" })
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
