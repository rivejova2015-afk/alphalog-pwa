import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/algorithms/[id]/quality-gates
// Devuelve breakdown del último score por gate + score agregado
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo } = await supabase
      .from("algorithms")
      .select("id, name, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const { data: definitions, error: defErr } = await supabase
      .from("algorithm_quality_gate_definitions")
      .select("*")
      .eq("is_active", true)
      .order("sort_index", { ascending: true });
    if (defErr) return NextResponse.json({ error: defErr.message }, { status: 500 });

    const { data: latestRows, error: rowsErr } = await supabase
      .from("algorithm_quality_gate_results")
      .select("gate_key,passed,value_observed,reason,computed_at")
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .order("computed_at", { ascending: false })
      .limit(200);
    if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

    // Pick latest row per gate_key
    const latestByKey = new Map<string, typeof latestRows[number]>();
    for (const row of latestRows ?? []) {
      if (!latestByKey.has(row.gate_key as string)) latestByKey.set(row.gate_key as string, row);
    }

    const breakdown = (definitions ?? []).map((d) => {
      const r = latestByKey.get(d.gate_key as string);
      return {
        gate_key:        d.gate_key,
        name:            d.name,
        category:        d.category,
        severity:        d.severity,
        threshold_op:    d.threshold_op,
        threshold_value: d.threshold_value,
        unit:            d.unit,
        description:     d.description,
        passed:          r?.passed ?? null,
        value_observed:  r?.value_observed ?? null,
        reason:          r?.reason ?? null,
        computed_at:     r?.computed_at ?? null,
      };
    });

    const { data: scoreRow } = await supabase
      .from("algorithm_quality_score")
      .select("*")
      .eq("algorithm_id", id)
      .maybeSingle();

    return NextResponse.json({
      algorithm:  { id: algo.id, name: algo.name, status: algo.status },
      score:      scoreRow ?? {
        algorithm_id:     id,
        gates_total:      breakdown.length,
        gates_passed:     0,
        must_failed:      0,
        should_failed:    0,
        last_computed_at: null,
        tier:             'NOT_READY',
      },
      breakdown,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("QualityGates", { component: "GET /api/algorithms/[id]/quality-gates", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
