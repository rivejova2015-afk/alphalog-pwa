import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeGates } from "@/lib/quality-gates/runner";
import { logError, logInfo, logWarn } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/algorithms/[id]/promote-to-live
// Verifica que las 20 quality gates tier-1 estén OK antes de set status='live'.
// Si must_failed > 0 → 403 con la lista de gates fallidos.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkAiRateLimit(user.id, "algo-promote", 5);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600), "X-RateLimit-Limit": "5" },
      });
    }

    const { data: algo } = await supabase
      .from("algorithms")
      .select("id, name, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    if (algo.status === "live") {
      return NextResponse.json({ error: "Algorithm ya está en estado live", algorithm: algo }, { status: 409 });
    }

    // Recompute fresh para evitar evaluar contra estado viejo
    const { score, results } = await computeGates(supabase, id, user.id);

    if (score.must_failed > 0 || score.gates_passed < score.gates_total) {
      const failed = results.filter((r) => !r.passed).map((r) => ({
        gate_key: r.gate_key,
        reason:   r.reason,
      }));
      logWarn("QualityGates", "promote-to-live BLOCKED", {
        algorithm_id: id,
        gates_passed: score.gates_passed,
        must_failed:  score.must_failed,
        failed:       failed.map((f) => f.gate_key),
      });
      return NextResponse.json({
        error:        "Tier-1 quality gates not passed — promotion blocked",
        score,
        failed,
      }, { status: 403 });
    }

    const { data: updated, error: updErr } = await supabase
      .from("algorithms")
      .update({ status: "live" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    logInfo("QualityGates", "promote-to-live OK", {
      algorithm_id: id,
      gates_passed: score.gates_passed,
      tier: score.tier,
    });

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "algorithm", resourceId: id, status: "success" },
      req
    );

    return NextResponse.json({ algorithm: updated, score });
  } catch (err) {
    logError("QualityGates", { component: "POST promote-to-live", message: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
