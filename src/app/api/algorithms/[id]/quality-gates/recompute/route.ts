import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeGates } from "@/lib/quality-gates/runner";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/algorithms/[id]/quality-gates/recompute
// Dispara la evaluación de las 20 gates y persiste resultados.
export async function POST(_req: NextRequest, { params }: Ctx) {
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

    const t0 = Date.now();
    const { score, results } = await computeGates(supabase, id, user.id);
    logInfo("QualityGates", "POST /api/algorithms/[id]/quality-gates/recompute", {
      algorithm_id: id,
      gates_passed: score.gates_passed,
      must_failed:  score.must_failed,
      tier:         score.tier,
      duration_ms:  Date.now() - t0,
    });
    return NextResponse.json({ score, results });
  } catch (err) {
    logError("QualityGates", { component: "POST recompute", message: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
